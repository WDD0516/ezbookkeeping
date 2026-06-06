<template>
    <f7-page>
        <f7-navbar>
            <f7-nav-left :back-link="tt('Back')"></f7-nav-left>
            <f7-nav-title :title="tt('Batch Add Transactions')"></f7-nav-title>
            <f7-nav-right class="navbar-compact-icons">
                <f7-link icon-f7="checkmark_alt" :class="{ 'disabled': !inputIsValid || submitting }" @click="save"></f7-link>
            </f7-nav-right>
        </f7-navbar>

        <f7-list strong inset dividers class="margin-vertical">
            <f7-list-item
                class="transaction-edit-datetime list-item-with-header-and-title"
                link="#" no-chevron
                :header="tt('Transaction Date')"
                :title="displayTransactionDate"
                @click="showTransactionDateSheet = true"
            >
                <date-time-selection-sheet :date-only="true"
                                           :timezone-utc-offset="utcOffset"
                                           :model-value="transactionDate"
                                           v-model:show="showTransactionDateSheet"
                                           @update:model-value="updateTransactionDate">
                </date-time-selection-sheet>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers accordion-list class="margin-vertical batch-add-row-list"
                 :key="index" v-for="(row, index) in rows">
            <f7-list-item accordion-item
                          :opened="openRowIndex === index"
                          @accordion:open="openRowIndex = index"
                          @accordion:close="onAccordionClose(index)">
                <template #title>
                    <div class="batch-add-row-summary">
                        <f7-badge :color="getRowTypeBadgeColor(row)">{{ tt(getRowTypeName(row)) }}</f7-badge>
                        <span class="batch-add-row-amount">{{ getDisplayAmount(row.sourceAmount, getRowCurrency(row.sourceAccountId)) }}</span>
                        <span class="batch-add-row-detail" v-if="getRowSummaryText(row)">{{ getRowSummaryText(row) }}</span>
                    </div>
                </template>
                <f7-accordion-content :style="{ height: openRowIndex === index ? 'auto' : '' }">
                    <f7-block class="no-margin-vertical">
                        <f7-segmented strong round class="margin-bottom-half">
                            <f7-button round :text="tt('Expense')" :active="row.type === TransactionType.Expense"
                                       @click="updateRowType(row, TransactionType.Expense)"></f7-button>
                            <f7-button round :text="tt('Income')" :active="row.type === TransactionType.Income"
                                       @click="updateRowType(row, TransactionType.Income)"></f7-button>
                            <f7-button round :text="tt('Transfer')" :active="row.type === TransactionType.Transfer"
                                       @click="updateRowType(row, TransactionType.Transfer)"></f7-button>
                        </f7-segmented>

                        <f7-list strong inset dividers class="no-margin">
                            <f7-list-item
                                class="transaction-edit-amount"
                                link="#" no-chevron
                                :header="row.type === TransactionType.Transfer ? tt('Transfer Out Amount') : tt('Amount')"
                                :title="getDisplayAmount(row.sourceAmount, getRowCurrency(row.sourceAccountId))"
                                @click="openSourceAmount(index)"
                            ></f7-list-item>

                            <f7-list-item
                                class="transaction-edit-amount"
                                link="#" no-chevron
                                :header="tt('Transfer In Amount')"
                                :title="getDisplayAmount(row.destinationAmount, getRowCurrency(row.destinationAccountId))"
                                v-if="row.type === TransactionType.Transfer"
                                @click="openDestinationAmount(index)"
                            ></f7-list-item>

                            <f7-list-item
                                class="list-item-with-header-and-title list-item-title-hide-overflow"
                                link="#" no-chevron
                                :header="tt('Category')"
                                @click="openCategory(index)"
                            >
                                <template #title>
                                    <div class="list-item-custom-title">
                                        <span>{{ getRowCategoryPrimaryName(row) }}</span>
                                        <f7-icon class="category-separate-icon icon-with-direction" f7="chevron_right" v-if="getRowCategorySecondaryName(row)"></f7-icon>
                                        <span>{{ getRowCategorySecondaryName(row) }}</span>
                                    </div>
                                </template>
                            </f7-list-item>

                            <f7-list-item
                                class="list-item-with-header-and-title"
                                link="#" no-chevron
                                :header="row.type === TransactionType.Transfer ? tt('Source Account') : tt('Account')"
                                :title="getAccountName(row.sourceAccountId)"
                                @click="openSourceAccount(index)"
                            ></f7-list-item>

                            <f7-list-item
                                class="list-item-with-header-and-title"
                                link="#" no-chevron
                                :header="tt('Destination Account')"
                                :title="getAccountName(row.destinationAccountId)"
                                v-if="row.type === TransactionType.Transfer"
                                @click="openDestinationAccount(index)"
                            ></f7-list-item>

                            <f7-list-item
                                class="list-item-with-header-and-title list-item-title-hide-overflow"
                                link="#" no-chevron
                                :header="tt('Tags')"
                                :title="getRowTagsText(row)"
                                @click="openTags(index)"
                            ></f7-list-item>

                            <f7-list-input
                                type="text"
                                :label="tt('Description')"
                                :placeholder="tt('Your transaction description (optional)')"
                                v-model:value="row.comment"
                            ></f7-list-input>
                        </f7-list>

                        <f7-block class="no-margin-bottom margin-top-half d-flex">
                            <f7-button small @click="onDuplicateRow(index)">{{ tt('Duplicate') }}</f7-button>
                            <div style="flex: 1"></div>
                            <f7-button small color="red" :class="{ 'disabled': rows.length <= 1 }" @click="removeRow(index)">{{ tt('Remove') }}</f7-button>
                        </f7-block>
                    </f7-block>
                </f7-accordion-content>
            </f7-list-item>
        </f7-list>

        <f7-block class="margin-vertical">
            <f7-button large fill @click="onAddRow">{{ tt('Add Row') }}</f7-button>
        </f7-block>

        <number-pad-sheet :min-value="TRANSACTION_MIN_AMOUNT"
                          :max-value="TRANSACTION_MAX_AMOUNT"
                          :currency="activeSourceCurrency"
                          v-model:show="showSourceAmountSheet"
                          v-model="activeSourceAmount">
        </number-pad-sheet>

        <number-pad-sheet :min-value="TRANSACTION_MIN_AMOUNT"
                          :max-value="TRANSACTION_MAX_AMOUNT"
                          :currency="activeDestinationCurrency"
                          v-model:show="showDestinationAmountSheet"
                          v-model="activeDestinationAmount">
        </number-pad-sheet>

        <tree-view-selection-sheet primary-key-field="id" primary-title-field="name"
                                   primary-icon-field="icon" primary-icon-type="category" primary-color-field="color"
                                   primary-hidden-field="hidden" primary-sub-items-field="subCategories"
                                   secondary-key-field="id" secondary-value-field="id" secondary-title-field="name"
                                   secondary-icon-field="icon" secondary-icon-type="category" secondary-color-field="color"
                                   secondary-hidden-field="hidden"
                                   :enable-filter="true" :filter-placeholder="tt('Find category')" :filter-no-items-text="tt('No available category')"
                                   :items="activeCategoryItems"
                                   v-model:show="showCategorySheet"
                                   v-model="activeCategoryId">
        </tree-view-selection-sheet>

        <two-column-list-item-selection-sheet primary-key-field="id" primary-value-field="category"
                                              primary-title-field="name" primary-footer-field="displayBalance"
                                              primary-icon-field="icon" primary-icon-type="account"
                                              primary-sub-items-field="accounts"
                                              :primary-title-i18n="true"
                                              secondary-key-field="id" secondary-value-field="id"
                                              secondary-title-field="name" secondary-footer-field="displayBalance"
                                              secondary-icon-field="icon" secondary-icon-type="account" secondary-color-field="color"
                                              :enable-filter="true" :filter-placeholder="tt('Find account')" :filter-no-items-text="tt('No available account')"
                                              :items="allVisibleCategorizedAccounts"
                                              v-model:show="showSourceAccountSheet"
                                              v-model="activeSourceAccountId">
        </two-column-list-item-selection-sheet>

        <two-column-list-item-selection-sheet primary-key-field="id" primary-value-field="category"
                                              primary-title-field="name" primary-footer-field="displayBalance"
                                              primary-icon-field="icon" primary-icon-type="account"
                                              primary-sub-items-field="accounts"
                                              :primary-title-i18n="true"
                                              secondary-key-field="id" secondary-value-field="id"
                                              secondary-title-field="name" secondary-footer-field="displayBalance"
                                              secondary-icon-field="icon" secondary-icon-type="account" secondary-color-field="color"
                                              :enable-filter="true" :filter-placeholder="tt('Find account')" :filter-no-items-text="tt('No available account')"
                                              :items="allVisibleCategorizedAccounts"
                                              v-model:show="showDestinationAccountSheet"
                                              v-model="activeDestinationAccountId">
        </two-column-list-item-selection-sheet>

        <transaction-tag-selection-sheet :allow-add-new-tag="false" :enable-filter="true"
                                         v-model:show="showTagsSheet"
                                         v-model="activeTagIds">
        </transaction-tag-selection-sheet>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import type { Router } from 'framework7/types';

import { useI18n } from '@/locales/helpers.ts';
import { useTransactionBatchAddPageBase } from '@/views/base/transactions/TransactionBatchAddPageBase.ts';

import { useI18nUIComponents, showLoading, hideLoading } from '@/lib/ui/mobile.ts';

import { TransactionType } from '@/core/transaction.ts';
import { CategoryType } from '@/core/category.ts';

import type { Transaction } from '@/models/transaction.ts';
import type { TransactionCategory } from '@/models/transaction_category.ts';

import { TRANSACTION_MAX_AMOUNT, TRANSACTION_MIN_AMOUNT } from '@/consts/transaction.ts';

import {
    getTransactionPrimaryCategoryName,
    getTransactionSecondaryCategoryName
} from '@/lib/category.ts';

import { parseDateTimeFromUnixTimeWithTimezoneOffset } from '@/lib/datetime.ts';

const props = defineProps<{
    f7route: Router.Route;
    f7router: Router.Router;
}>();

const { formatDateTimeToLongDate } = useI18n();
const { showToast } = useI18nUIComponents();

const {
    tt,
    submitting,
    utcOffset,
    transactionDate,
    rows,
    defaultCurrency,
    allAccountsMap,
    allVisibleCategorizedAccounts,
    allCategories,
    formatAmountToLocalizedNumeralsWithCurrency,
    updateTransactionDate,
    updateRowType,
    addRow,
    duplicateRow,
    removeRow,
    inputProblemMessage,
    inputIsValid,
    save: saveBatch
} = useTransactionBatchAddPageBase();

const activeRowIndex = ref<number>(0);
const openRowIndex = ref<number>(0);
const showTransactionDateSheet = ref<boolean>(false);
const showSourceAmountSheet = ref<boolean>(false);
const showDestinationAmountSheet = ref<boolean>(false);
const showCategorySheet = ref<boolean>(false);
const showSourceAccountSheet = ref<boolean>(false);
const showDestinationAccountSheet = ref<boolean>(false);
const showTagsSheet = ref<boolean>(false);

const activeRow = computed<Transaction | undefined>(() => rows.value[activeRowIndex.value]);

const displayTransactionDate = computed<string>(() => formatDateTimeToLongDate(parseDateTimeFromUnixTimeWithTimezoneOffset(transactionDate.value, utcOffset.value)));

function getRowCategoryType(row: Transaction): number {
    if (row.type === TransactionType.Income) {
        return CategoryType.Income;
    } else if (row.type === TransactionType.Transfer) {
        return CategoryType.Transfer;
    } else {
        return CategoryType.Expense;
    }
}

function getRowCurrency(accountId: string): string {
    const account = allAccountsMap.value[accountId];
    return account ? account.currency : defaultCurrency.value;
}

function getAccountName(accountId: string): string {
    const account = allAccountsMap.value[accountId];
    return account ? account.name : tt('None');
}

function getDisplayAmount(amount: number, currency: string): string {
    return formatAmountToLocalizedNumeralsWithCurrency(amount, currency);
}

function getRowCategoryPrimaryName(row: Transaction): string {
    return getTransactionPrimaryCategoryName(row.getCategoryId(), allCategories.value[getRowCategoryType(row)]);
}

function getRowCategorySecondaryName(row: Transaction): string {
    return getTransactionSecondaryCategoryName(row.getCategoryId(), allCategories.value[getRowCategoryType(row)]);
}

function getRowTagsText(row: Transaction): string {
    return row.tagIds && row.tagIds.length > 0 ? `${row.tagIds.length}` : tt('None');
}

function getRowTypeName(row: Transaction): string {
    if (row.type === TransactionType.Income) {
        return 'Income';
    } else if (row.type === TransactionType.Transfer) {
        return 'Transfer';
    } else {
        return 'Expense';
    }
}

function getRowTypeBadgeColor(row: Transaction): string {
    if (row.type === TransactionType.Income) {
        return 'green';
    } else if (row.type === TransactionType.Transfer) {
        return 'blue';
    } else {
        return 'red';
    }
}

function getRowSummaryText(row: Transaction): string {
    const categoryName = getRowCategorySecondaryName(row) || getRowCategoryPrimaryName(row);
    let accountText = getAccountName(row.sourceAccountId);

    if (row.type === TransactionType.Transfer) {
        accountText = `${getAccountName(row.sourceAccountId)} → ${getAccountName(row.destinationAccountId)}`;
    }

    return [categoryName, accountText].filter(text => !!text).join(' · ');
}

function onAccordionClose(index: number): void {
    if (openRowIndex.value === index) {
        openRowIndex.value = -1;
    }
}

function onAddRow(): void {
    addRow();
    openRowIndex.value = rows.value.length - 1;
}

function onDuplicateRow(index: number): void {
    duplicateRow(index);
    openRowIndex.value = index + 1;
}

const activeSourceCurrency = computed<string>(() => getRowCurrency(activeRow.value ? activeRow.value.sourceAccountId : ''));
const activeDestinationCurrency = computed<string>(() => getRowCurrency(activeRow.value ? activeRow.value.destinationAccountId : ''));
const activeCategoryItems = computed<TransactionCategory[]>(() => activeRow.value ? (allCategories.value[getRowCategoryType(activeRow.value)] || []) : []);

const activeSourceAmount = computed<number>({
    get: () => activeRow.value ? activeRow.value.sourceAmount : 0,
    set: (value: number) => { if (activeRow.value) { activeRow.value.sourceAmount = value; } }
});
const activeDestinationAmount = computed<number>({
    get: () => activeRow.value ? activeRow.value.destinationAmount : 0,
    set: (value: number) => { if (activeRow.value) { activeRow.value.destinationAmount = value; } }
});
const activeSourceAccountId = computed<string>({
    get: () => activeRow.value ? activeRow.value.sourceAccountId : '',
    set: (value: string) => { if (activeRow.value) { activeRow.value.sourceAccountId = value; } }
});
const activeDestinationAccountId = computed<string>({
    get: () => activeRow.value ? activeRow.value.destinationAccountId : '',
    set: (value: string) => { if (activeRow.value) { activeRow.value.destinationAccountId = value; } }
});
const activeCategoryId = computed<string>({
    get: () => activeRow.value ? activeRow.value.getCategoryId() : '',
    set: (value: string) => { if (activeRow.value) { activeRow.value.setCategoryId(value); } }
});
const activeTagIds = computed<string[]>({
    get: () => activeRow.value ? activeRow.value.tagIds : [],
    set: (value: string[]) => { if (activeRow.value) { activeRow.value.tagIds = value; } }
});

function openSourceAmount(index: number): void {
    activeRowIndex.value = index;
    showSourceAmountSheet.value = true;
}

function openDestinationAmount(index: number): void {
    activeRowIndex.value = index;
    showDestinationAmountSheet.value = true;
}

function openCategory(index: number): void {
    activeRowIndex.value = index;
    showCategorySheet.value = true;
}

function openSourceAccount(index: number): void {
    activeRowIndex.value = index;
    showSourceAccountSheet.value = true;
}

function openDestinationAccount(index: number): void {
    activeRowIndex.value = index;
    showDestinationAccountSheet.value = true;
}

function openTags(index: number): void {
    activeRowIndex.value = index;
    showTagsSheet.value = true;
}

function save(): void {
    const problemMessage = inputProblemMessage.value;

    if (problemMessage) {
        showToast(problemMessage);
        return;
    }

    if (submitting.value) {
        return;
    }

    submitting.value = true;
    showLoading();

    saveBatch().then(count => {
        submitting.value = false;
        hideLoading();
        showToast(tt('format.misc.batchAddedTransactions', { count: count }));
        props.f7router.back();
    }).catch(error => {
        submitting.value = false;
        hideLoading();

        if (!error.processed) {
            showToast(error.message ? error.message : 'Unable to add transaction');
        }
    });
}
</script>

<style scoped>
.batch-add-row-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
}

.batch-add-row-summary .batch-add-row-amount {
    font-weight: 500;
    white-space: nowrap;
}

.batch-add-row-summary .batch-add-row-detail {
    color: var(--f7-list-item-after-text-color, #8e8e93);
    font-size: var(--f7-list-item-after-font-size, 14px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
