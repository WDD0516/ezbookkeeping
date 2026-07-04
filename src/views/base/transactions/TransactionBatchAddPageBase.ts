import { ref, computed } from 'vue';

import { useI18n } from '@/locales/helpers.ts';

import { useSettingsStore } from '@/stores/setting.ts';
import { useUserStore } from '@/stores/user.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useTransactionCategoriesStore } from '@/stores/transactionCategory.ts';
import { useTransactionTagsStore } from '@/stores/transactionTag.ts';
import { useTransactionsStore } from '@/stores/transaction.ts';

import { TransactionType } from '@/core/transaction.ts';

import { Account, type CategorizedAccountWithDisplayBalance } from '@/models/account.ts';
import type { TransactionCategory } from '@/models/transaction_category.ts';
import type { TransactionTag } from '@/models/transaction_tag.ts';
import { Transaction } from '@/models/transaction.ts';

import { generateRandomUUID } from '@/lib/misc.ts';
import {
    getTimezoneOffsetMinutes,
    getStartOfDayUnixTimeWithTimezoneOffset,
    getSameDateTimeWithCurrentTimezone,
    parseDateTimeFromUnixTimeWithBrowserTimezone,
    getCurrentUnixTime
} from '@/lib/datetime.ts';

// useTransactionBatchAddPageBase holds the shared logic for batch adding multiple transactions on a single date.
// Each row is a Transaction model instance (reusing its category-by-type and toCreateRequest helpers); a single
// date is shared across all rows. Balance modification transactions are intentionally not supported here.
export function useTransactionBatchAddPageBase() {
    const {
        tt,
        getCurrentNumeralSystemType,
        formatAmountToLocalizedNumeralsWithCurrency,
        getCategorizedAccountsWithDisplayBalance
    } = useI18n();

    const settingsStore = useSettingsStore();
    const userStore = useUserStore();
    const accountsStore = useAccountsStore();
    const transactionCategoriesStore = useTransactionCategoriesStore();
    const transactionTagsStore = useTransactionTagsStore();
    const transactionsStore = useTransactionsStore();

    const currentTimezone: string = settingsStore.appSettings.timeZone;

    const submitting = ref<boolean>(false);
    const clientSessionId = ref<string>(generateRandomUUID());

    function getStartOfTodayUnixTime(): number {
        const now: number = getSameDateTimeWithCurrentTimezone(parseDateTimeFromUnixTimeWithBrowserTimezone(getCurrentUnixTime())).getUnixTime();
        return getStartOfDayUnixTimeWithTimezoneOffset(now, getTimezoneOffsetMinutes(now, currentTimezone));
    }

    const utcOffset = ref<number>(getTimezoneOffsetMinutes(getCurrentUnixTime(), currentTimezone));

    // Default to the date of the last transaction the user added this session (collapsed to the
    // start of the day), so batch-adding several days of history in a row doesn't require re-picking
    // the date each time. Falls back to today when nothing has been added yet.
    function getInitialTransactionDate(): number {
        const lastUsedDate: number | null = transactionsStore.lastUsedTransactionDate;

        if (lastUsedDate !== null) {
            return getStartOfDayUnixTimeWithTimezoneOffset(lastUsedDate, utcOffset.value);
        }

        return getStartOfTodayUnixTime();
    }

    const transactionDate = ref<number>(getInitialTransactionDate());

    const showAccountBalance = computed<boolean>(() => settingsStore.appSettings.showAccountBalance);
    const customAccountCategoryOrder = computed<string>(() => settingsStore.appSettings.accountCategoryOrders);
    const defaultCurrency = computed<string>(() => userStore.currentUserDefaultCurrency);
    const defaultAccountId = computed<string>(() => userStore.currentUserDefaultAccountId);

    const allAccounts = computed<Account[]>(() => accountsStore.allPlainAccounts);
    const allVisibleAccounts = computed<Account[]>(() => accountsStore.allVisiblePlainAccounts);
    const allAccountsMap = computed<Record<string, Account>>(() => accountsStore.allAccountsMap);
    const allVisibleCategorizedAccounts = computed<CategorizedAccountWithDisplayBalance[]>(() => getCategorizedAccountsWithDisplayBalance(allVisibleAccounts.value, showAccountBalance.value, customAccountCategoryOrder.value));
    const allCategories = computed<Record<number, TransactionCategory[]>>(() => transactionCategoriesStore.allTransactionCategories);
    const allCategoriesMap = computed<Record<string, TransactionCategory>>(() => transactionCategoriesStore.allTransactionCategoriesMap);
    const allTagsMap = computed<Record<string, TransactionTag>>(() => transactionTagsStore.allTransactionTagsMap);

    function createNewRow(copyFrom?: Transaction): Transaction {
        const type: number = copyFrom ? copyFrom.type : TransactionType.Expense;
        const row: Transaction = Transaction.createNewTransaction(type, transactionDate.value, currentTimezone, utcOffset.value);

        if (copyFrom) {
            // A newly added row inherits the type and account for convenience, but NOT the category
            // (each transaction usually has a different category) — duplicateRow copies the category explicitly.
            row.sourceAccountId = copyFrom.sourceAccountId;
            row.destinationAccountId = copyFrom.destinationAccountId;
        } else {
            // Apply the user's default account the same way the single-transaction add page does
            const defaultAccount = allAccountsMap.value[defaultAccountId.value];

            if (defaultAccountId.value && defaultAccount && !defaultAccount.hidden) {
                row.sourceAccountId = defaultAccountId.value;
            } else if (allVisibleAccounts.value.length > 0) {
                row.sourceAccountId = allVisibleAccounts.value[0]!.id;
            }
        }

        return row;
    }

    const rows = ref<Transaction[]>([createNewRow()]);

    function addRow(): void {
        const lastRow: Transaction | undefined = rows.value.length > 0 ? rows.value[rows.value.length - 1] : undefined;
        rows.value.push(createNewRow(lastRow));
    }

    function duplicateRow(index: number): void {
        const row: Transaction | undefined = rows.value[index];

        if (!row) {
            return;
        }

        const newRow: Transaction = createNewRow(row);
        newRow.setCategoryId(row.getCategoryId());
        newRow.sourceAmount = row.sourceAmount;
        newRow.destinationAmount = row.destinationAmount;
        newRow.comment = row.comment;
        newRow.tagIds = row.tagIds.slice();
        rows.value.splice(index + 1, 0, newRow);
    }

    function removeRow(index: number): void {
        if (rows.value.length <= 1) {
            return;
        }

        rows.value.splice(index, 1);
    }

    function updateRowType(row: Transaction, newType: number): void {
        row.type = newType;

        if (newType !== TransactionType.Transfer) {
            row.destinationAccountId = '';
            row.destinationAmount = 0;
        }
    }

    function updateTransactionDate(newTime: number): void {
        transactionDate.value = getStartOfDayUnixTimeWithTimezoneOffset(newTime, utcOffset.value);
        // Remember the picked date immediately (not only on save) so closing and reopening keeps it.
        transactionsStore.lastUsedTransactionDate = transactionDate.value;
    }

    function getRowProblemMessage(row: Transaction): string | null {
        if (row.type === TransactionType.Expense || row.type === TransactionType.Income) {
            if (!row.getCategoryId() || row.getCategoryId() === '') {
                return 'Transaction category cannot be blank';
            }

            if (!row.sourceAccountId || row.sourceAccountId === '') {
                return 'Transaction account cannot be blank';
            }
        } else if (row.type === TransactionType.Transfer) {
            if (!row.getCategoryId() || row.getCategoryId() === '') {
                return 'Transaction category cannot be blank';
            }

            if (!row.sourceAccountId || row.sourceAccountId === '') {
                return 'Source account cannot be blank';
            }

            if (!row.destinationAccountId || row.destinationAccountId === '') {
                return 'Destination account cannot be blank';
            }
        }

        return null;
    }

    const inputProblemMessage = computed<string | null>(() => {
        if (!transactionDate.value) {
            return 'Transaction date cannot be blank';
        }

        if (!rows.value || rows.value.length < 1) {
            return 'Please add at least one transaction';
        }

        for (const row of rows.value) {
            const problem = getRowProblemMessage(row);

            if (problem) {
                return problem;
            }
        }

        return null;
    });

    const inputIsValid = computed<boolean>(() => !inputProblemMessage.value);

    function reset(): void {
        clientSessionId.value = generateRandomUUID();
        utcOffset.value = getTimezoneOffsetMinutes(getCurrentUnixTime(), currentTimezone);
        transactionDate.value = getInitialTransactionDate();
        rows.value = [createNewRow()];
        submitting.value = false;
    }

    function save(): Promise<number> {
        const transactions = rows.value.map(row => {
            row.time = transactionDate.value;
            row.utcOffset = utcOffset.value;
            return row.toCreateRequest('');
        });

        return transactionsStore.saveBatchTransactions({
            transactions: transactions,
            clientSessionId: clientSessionId.value
        });
    }

    return {
        // states
        submitting,
        clientSessionId,
        utcOffset,
        transactionDate,
        rows,
        // computed states
        defaultCurrency,
        defaultAccountId,
        allAccounts,
        allVisibleAccounts,
        allAccountsMap,
        allVisibleCategorizedAccounts,
        allCategories,
        allCategoriesMap,
        allTagsMap,
        inputProblemMessage,
        inputIsValid,
        // functions
        getCurrentNumeralSystemType,
        formatAmountToLocalizedNumeralsWithCurrency,
        tt,
        createNewRow,
        addRow,
        duplicateRow,
        removeRow,
        updateRowType,
        updateTransactionDate,
        getRowProblemMessage,
        reset,
        save
    };
}
