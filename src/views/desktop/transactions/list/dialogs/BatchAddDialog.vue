<template>
    <v-dialog width="900" :persistent="submitting" v-model="showState">
        <v-card class="pa-2 pa-sm-4">
            <template #title>
                <div class="d-flex align-center justify-space-between">
                    <span>{{ tt('Batch Add Transactions') }}</span>
                </div>
            </template>
            <v-card-text class="mt-sm-2 mt-md-4">
                <v-row>
                    <v-col cols="12" md="6">
                        <date-time-select
                            :date-only="true"
                            :disabled="submitting"
                            :label="tt('Transaction Date')"
                            :timezone-utc-offset="utcOffset"
                            :model-value="transactionDate"
                            @update:model-value="updateTransactionDate" />
                    </v-col>
                </v-row>

                <v-expansion-panels class="mt-2" v-model="expandedPanel">
                    <v-expansion-panel :key="index" v-for="(row, index) in rows">
                        <v-expansion-panel-title>
                            <div class="d-flex align-center w-100">
                                <v-chip label size="small" class="me-3" :color="getRowTypeColor(row)">{{ tt(getRowTypeName(row)) }}</v-chip>
                                <span class="font-weight-medium">{{ getDisplayAmount(row.sourceAmount, getRowCurrency(row.sourceAccountId)) }}</span>
                                <span class="text-medium-emphasis text-truncate ms-3" v-if="getRowSummaryText(row)">{{ getRowSummaryText(row) }}</span>
                                <v-spacer />
                                <v-btn class="me-1" density="comfortable" variant="text" color="default" :icon="true"
                                       :disabled="submitting" @click.stop="onDuplicateRow(index)">
                                    <v-icon :icon="mdiContentCopy" size="20" />
                                    <v-tooltip activator="parent">{{ tt('Duplicate') }}</v-tooltip>
                                </v-btn>
                                <v-btn class="me-2" density="comfortable" variant="text" color="default" :icon="true"
                                       :disabled="submitting || rows.length <= 1" @click.stop="removeRow(index)">
                                    <v-icon :icon="mdiTrashCanOutline" size="20" />
                                    <v-tooltip activator="parent">{{ tt('Remove') }}</v-tooltip>
                                </v-btn>
                            </div>
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-row>
                                <v-col cols="12">
                                    <v-tabs class="v-tabs-pill" :disabled="submitting"
                                            :model-value="row.type"
                                            @update:model-value="(value: unknown) => updateRowType(row, value as number)">
                                        <v-tab :value="TransactionType.Expense"><span>{{ tt('Expense') }}</span></v-tab>
                                        <v-tab :value="TransactionType.Income"><span>{{ tt('Income') }}</span></v-tab>
                                        <v-tab :value="TransactionType.Transfer"><span>{{ tt('Transfer') }}</span></v-tab>
                                    </v-tabs>
                                </v-col>

                                <v-col cols="12" :md="row.type === TransactionType.Transfer ? 6 : 12">
                                    <amount-input class="font-weight-bold"
                                                  :currency="getRowCurrency(row.sourceAccountId)"
                                                  :show-currency="true"
                                                  :disabled="submitting"
                                                  :persistent-placeholder="true"
                                                  :label="row.type === TransactionType.Transfer ? tt('Transfer Out Amount') : tt('Amount')"
                                                  :placeholder="tt('Amount')"
                                                  :enable-formula="true"
                                                  v-model="row.sourceAmount" />
                                </v-col>
                                <v-col cols="12" md="6" v-if="row.type === TransactionType.Transfer">
                                    <amount-input class="font-weight-bold" color="primary"
                                                  :currency="getRowCurrency(row.destinationAccountId)"
                                                  :show-currency="true"
                                                  :disabled="submitting"
                                                  :persistent-placeholder="true"
                                                  :label="tt('Transfer In Amount')"
                                                  :placeholder="tt('Transfer In Amount')"
                                                  :enable-formula="true"
                                                  v-model="row.destinationAmount" />
                                </v-col>

                                <v-col cols="12">
                                    <two-column-select primary-key-field="id" primary-value-field="id" primary-title-field="name"
                                                       primary-icon-field="icon" primary-icon-type="category" primary-color-field="color"
                                                       primary-hidden-field="hidden" primary-sub-items-field="subCategories"
                                                       secondary-key-field="id" secondary-value-field="id" secondary-title-field="name"
                                                       secondary-icon-field="icon" secondary-icon-type="category" secondary-color-field="color"
                                                       secondary-hidden-field="hidden"
                                                       :disabled="submitting"
                                                       :enable-filter="true" :filter-placeholder="tt('Find category')" :filter-no-items-text="tt('No available category')"
                                                       :show-selection-primary-text="true"
                                                       :custom-selection-primary-text="getTransactionPrimaryCategoryName(getRowCategoryId(row), allCategories[getRowCategoryType(row)])"
                                                       :custom-selection-secondary-text="getTransactionSecondaryCategoryName(getRowCategoryId(row), allCategories[getRowCategoryType(row)])"
                                                       :label="tt('Category')" :placeholder="tt('Category')"
                                                       :items="allCategories[getRowCategoryType(row)] || []"
                                                       :model-value="getRowCategoryId(row)"
                                                       @update:model-value="(value: string) => row.setCategoryId(value)">
                                    </two-column-select>
                                </v-col>

                                <v-col cols="12" :md="row.type === TransactionType.Transfer ? 6 : 12">
                                    <two-column-select primary-key-field="id" primary-value-field="category"
                                                       primary-title-field="name" primary-footer-field="displayBalance"
                                                       primary-icon-field="icon" primary-icon-type="account"
                                                       primary-sub-items-field="accounts"
                                                       :primary-title-i18n="true"
                                                       secondary-key-field="id" secondary-value-field="id"
                                                       secondary-title-field="name" secondary-footer-field="displayBalance"
                                                       secondary-icon-field="icon" secondary-icon-type="account" secondary-color-field="color"
                                                       :disabled="submitting || !allVisibleAccounts.length"
                                                       :enable-filter="true" :filter-placeholder="tt('Find account')" :filter-no-items-text="tt('No available account')"
                                                       :custom-selection-primary-text="getAccountName(row.sourceAccountId)"
                                                       :label="row.type === TransactionType.Transfer ? tt('Source Account') : tt('Account')"
                                                       :placeholder="row.type === TransactionType.Transfer ? tt('Source Account') : tt('Account')"
                                                       :items="allVisibleCategorizedAccounts"
                                                       v-model="row.sourceAccountId">
                                    </two-column-select>
                                </v-col>
                                <v-col cols="12" md="6" v-if="row.type === TransactionType.Transfer">
                                    <two-column-select primary-key-field="id" primary-value-field="category"
                                                       primary-title-field="name" primary-footer-field="displayBalance"
                                                       primary-icon-field="icon" primary-icon-type="account"
                                                       primary-sub-items-field="accounts"
                                                       :primary-title-i18n="true"
                                                       secondary-key-field="id" secondary-value-field="id"
                                                       secondary-title-field="name" secondary-footer-field="displayBalance"
                                                       secondary-icon-field="icon" secondary-icon-type="account" secondary-color-field="color"
                                                       :disabled="submitting || !allVisibleAccounts.length"
                                                       :enable-filter="true" :filter-placeholder="tt('Find account')" :filter-no-items-text="tt('No available account')"
                                                       :custom-selection-primary-text="getAccountName(row.destinationAccountId)"
                                                       :label="tt('Destination Account')"
                                                       :placeholder="tt('Destination Account')"
                                                       :items="allVisibleCategorizedAccounts"
                                                       v-model="row.destinationAccountId">
                                    </two-column-select>
                                </v-col>

                                <v-col cols="12">
                                    <transaction-tag-auto-complete
                                        :disabled="submitting"
                                        :show-label="true"
                                        :allow-add-new-tag="false"
                                        v-model="row.tagIds" />
                                </v-col>
                                <v-col cols="12">
                                    <v-text-field
                                        type="text"
                                        persistent-placeholder
                                        :disabled="submitting"
                                        :label="tt('Description')"
                                        :placeholder="tt('Your transaction description (optional)')"
                                        v-model="row.comment" />
                                </v-col>
                            </v-row>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>

                <v-btn class="mt-3" variant="tonal" color="primary" :prepend-icon="mdiPlus" :disabled="submitting" @click="onAddRow">
                    {{ tt('Add Row') }}
                </v-btn>
            </v-card-text>
            <v-card-text class="d-flex justify-center gap-4">
                <v-btn :disabled="submitting" @click="confirm">
                    {{ tt('Add') }}
                    <v-progress-circular indeterminate size="22" class="ms-2" v-if="submitting"></v-progress-circular>
                </v-btn>
                <v-btn color="secondary" variant="tonal" :disabled="submitting" @click="cancel">{{ tt('Cancel') }}</v-btn>
            </v-card-text>
        </v-card>
        <snack-bar ref="snackbar" />
    </v-dialog>
</template>

<script setup lang="ts">
import SnackBar from '@/components/desktop/SnackBar.vue';

import { ref, useTemplateRef } from 'vue';

import { useTransactionBatchAddPageBase } from '@/views/base/transactions/TransactionBatchAddPageBase.ts';

import { TransactionType } from '@/core/transaction.ts';
import { CategoryType } from '@/core/category.ts';

import { Transaction } from '@/models/transaction.ts';

import {
    getTransactionPrimaryCategoryName,
    getTransactionSecondaryCategoryName
} from '@/lib/category.ts';

import {
    mdiPlus,
    mdiContentCopy,
    mdiTrashCanOutline
} from '@mdi/js';

type SnackBarType = InstanceType<typeof SnackBar>;

const {
    tt,
    submitting,
    utcOffset,
    transactionDate,
    rows,
    defaultCurrency,
    allAccountsMap,
    allVisibleAccounts,
    allVisibleCategorizedAccounts,
    allCategories,
    updateTransactionDate,
    updateRowType,
    addRow,
    duplicateRow,
    removeRow,
    inputProblemMessage,
    formatAmountToLocalizedNumeralsWithCurrency,
    reset,
    save
} = useTransactionBatchAddPageBase();

const snackbar = useTemplateRef<SnackBarType>('snackbar');

const showState = ref<boolean>(false);
const expandedPanel = ref<number | undefined>(0);

let resolveFunc: ((result: { message: string }) => void) | null = null;
let rejectFunc: ((reason?: unknown) => void) | null = null;

function getRowCategoryType(row: Transaction): number {
    if (row.type === TransactionType.Income) {
        return CategoryType.Income;
    } else if (row.type === TransactionType.Transfer) {
        return CategoryType.Transfer;
    } else {
        return CategoryType.Expense;
    }
}

function getRowCategoryId(row: Transaction): string {
    return row.getCategoryId();
}

function getRowCurrency(accountId: string): string {
    const account = allAccountsMap.value[accountId];
    return account ? account.currency : defaultCurrency.value;
}

function getAccountName(accountId: string): string {
    const account = allAccountsMap.value[accountId];
    return account ? account.name : '';
}

function getDisplayAmount(amount: number, currency: string): string {
    return formatAmountToLocalizedNumeralsWithCurrency(amount, currency);
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

function getRowTypeColor(row: Transaction): string {
    if (row.type === TransactionType.Income) {
        return 'success';
    } else if (row.type === TransactionType.Transfer) {
        return 'primary';
    } else {
        return 'error';
    }
}

function getRowSummaryText(row: Transaction): string {
    const categoryName = getTransactionSecondaryCategoryName(getRowCategoryId(row), allCategories.value[getRowCategoryType(row)])
        || getTransactionPrimaryCategoryName(getRowCategoryId(row), allCategories.value[getRowCategoryType(row)]);

    let accountText = getAccountName(row.sourceAccountId);

    if (row.type === TransactionType.Transfer) {
        accountText = `${getAccountName(row.sourceAccountId)} → ${getAccountName(row.destinationAccountId)}`;
    }

    return [categoryName, accountText].filter(text => !!text).join(' · ');
}

function onAddRow(): void {
    addRow();
    expandedPanel.value = rows.value.length - 1;
}

function onDuplicateRow(index: number): void {
    duplicateRow(index);
    expandedPanel.value = index + 1;
}

function open(): Promise<{ message: string }> {
    reset();
    expandedPanel.value = 0;
    showState.value = true;

    return new Promise((resolve, reject) => {
        resolveFunc = resolve;
        rejectFunc = reject;
    });
}

function confirm(): void {
    const problemMessage = inputProblemMessage.value;

    if (problemMessage) {
        snackbar.value?.showMessage(problemMessage);
        return;
    }

    submitting.value = true;

    save().then(count => {
        submitting.value = false;
        showState.value = false;

        if (resolveFunc) {
            resolveFunc({ message: tt('format.misc.batchAddedTransactions', { count: count }) });
        }
    }).catch(error => {
        submitting.value = false;

        if (!error.processed) {
            snackbar.value?.showError(error);
        }
    });
}

function cancel(): void {
    showState.value = false;

    if (rejectFunc) {
        rejectFunc();
    }
}

defineExpose({
    open
});
</script>
