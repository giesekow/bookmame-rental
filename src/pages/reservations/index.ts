import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, Button, DialogForm, Dialogs, Report } from 'vuetify-extended';
import { ref, Ref } from 'vue';
import { rentalAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';

function getRentalProviderId() {
  const rentalProviderId = useAppStore().rentalProvider?.id;
  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.');
  }
  return rentalProviderId;
}

function getServicePath() {
  return `rental-providers/${getRentalProviderId()}/reservations`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0);
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((Number.isFinite(amount) ? amount : 0) / 100);
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`;
  }
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderReservationHtml(reservation: any) {
  const deliveryTasks = Array.isArray(reservation?.deliveryTasks) ? reservation.deliveryTasks : [];
  const ledgerLines = Array.isArray(reservation?.ledgerLines) ? reservation.ledgerLines : [];
  return `
    <div style="font-family:inherit; color:#241a14; background:#fffaf5; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:18px;">
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Reservation</div>
          <div style="font-weight:800; font-size:20px;">${escapeHtml(reservation?.reservationNumber || 'Reservation')}</div>
          <div style="margin-top:4px; color:#5f4e43;">Created ${escapeHtml(dateTime(reservation?.createdAt))}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Customer</div>
          <div style="font-weight:700;">${escapeHtml(reservation?.customerDisplayName || reservation?.customerAccountId || 'Unknown customer')}</div>
          ${reservation?.customerEmail ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(reservation.customerEmail)}</div>` : ''}
          ${reservation?.customerPhoneNumber ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(reservation.customerPhoneNumber)}</div>` : ''}
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Item</div>
          <div style="font-weight:700;">${escapeHtml(reservation?.rentalInventoryItem?.name || 'Inventory item')}</div>
          ${reservation?.rentalInventoryVariant?.name ? `<div style="margin-top:4px; color:#5f4e43;">Variant: ${escapeHtml(reservation.rentalInventoryVariant.name)}</div>` : ''}
          ${reservation?.rentalInventoryItem?.categoryLabel ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(reservation.rentalInventoryItem.categoryLabel)}</div>` : ''}
          <div style="margin-top:4px; color:#5f4e43;">Qty: ${escapeHtml(reservation?.quantity || 1)}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Amount</div>
          <div style="font-weight:700;">${escapeHtml(money(reservation?.totalAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Subtotal: ${escapeHtml(money(reservation?.subtotalAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Outbound delivery: ${escapeHtml(money(reservation?.outboundDeliveryFeeAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Return collection: ${escapeHtml(money(reservation?.returnDeliveryFeeAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit: ${escapeHtml(money(reservation?.securityDepositAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit status: ${escapeHtml(String(reservation?.securityDepositStatus || 'not_required').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit held: ${escapeHtml(money(reservation?.securityDepositHeldAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit deducted: ${escapeHtml(money(reservation?.securityDepositDeductedAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit refunded: ${escapeHtml(money(reservation?.securityDepositRefundedAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Service charge: ${escapeHtml(money(reservation?.serviceChargeAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Provider net: ${escapeHtml(money(reservation?.netAmount, reservation?.currency))}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:18px;">
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Rental Period</div>
          <div style="font-weight:700;">${escapeHtml(dateTime(reservation?.startDate))}</div>
          <div style="margin-top:4px; color:#5f4e43;">to ${escapeHtml(dateTime(reservation?.endDate))}</div>
          <div style="margin-top:4px; color:#5f4e43;">${escapeHtml(reservation?.dayCount || 0)} day(s)</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Status</div>
          <div style="font-weight:700;">${escapeHtml(String(reservation?.reservationStatus || 'requested').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Payment: ${escapeHtml(String(reservation?.paymentStatus || 'pending').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Method: ${escapeHtml(String(reservation?.paymentMethod || 'n/a').replace(/_/g, ' '))}</div>
          ${reservation?.paymentProvider ? `<div style="margin-top:4px; color:#5f4e43;">Provider: ${escapeHtml(String(reservation.paymentProvider).replace(/_/g, ' '))}</div>` : ''}
          ${reservation?.paymentReference ? `<div style="margin-top:4px; color:#5f4e43;">Reference: ${escapeHtml(reservation.paymentReference)}</div>` : ''}
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Fulfilment</div>
          <div style="font-weight:700;">${escapeHtml(String(reservation?.fulfillmentMethod || 'customer_pickup').replace(/_/g, ' '))}</div>
          ${reservation?.deliveryCompany?.name ? `<div style="margin-top:4px; color:#5f4e43;">Outbound: ${escapeHtml(reservation.deliveryCompany.name)}</div>` : ''}
          <div style="margin-top:4px; color:#5f4e43;">Return: ${escapeHtml(String(reservation?.returnFulfillmentMethod || 'return_by_customer').replace(/_/g, ' '))}</div>
          ${reservation?.returnDeliveryCompany?.name ? `<div style="margin-top:4px; color:#5f4e43;">Return partner: ${escapeHtml(reservation.returnDeliveryCompany.name)}</div>` : ''}
        </div>
      </div>

      ${reservation?.deliveryAddressLine1 ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Delivery / Collection Address</div>
          <div style="color:#5f4e43; white-space:pre-wrap;">${escapeHtml([
            reservation.deliveryLabel,
            reservation.deliveryAddressLine1,
            reservation.deliveryAddressLine2,
            reservation.deliveryLandmark,
          ].filter(Boolean).join(', '))}</div>
          ${reservation?.deliveryContactName ? `<div style="margin-top:6px; color:#5f4e43;">Contact: ${escapeHtml(reservation.deliveryContactName)}</div>` : ''}
          ${reservation?.deliveryContactPhone ? `<div style="margin-top:4px; color:#5f4e43;">Phone: ${escapeHtml(reservation.deliveryContactPhone)}</div>` : ''}
        </div>
      ` : ''}

      ${reservation?.notes ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Notes</div>
          <div style="color:#5f4e43; white-space:pre-wrap;">${escapeHtml(reservation.notes)}</div>
        </div>
      ` : ''}

      ${(reservation?.securityDepositResolutionReason || reservation?.securityDepositRefundReference || reservation?.securityDepositResolvedAt) ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Deposit Resolution</div>
          ${reservation?.securityDepositResolutionReason ? `<div style="color:#5f4e43; margin-top:4px;">Reason: ${escapeHtml(reservation.securityDepositResolutionReason)}</div>` : ''}
          ${reservation?.securityDepositRefundReference ? `<div style="color:#5f4e43; margin-top:4px;">Refund Reference: ${escapeHtml(reservation.securityDepositRefundReference)}</div>` : ''}
          ${reservation?.securityDepositResolvedAt ? `<div style="color:#5f4e43; margin-top:4px;">Resolved At: ${escapeHtml(dateTime(reservation.securityDepositResolvedAt))}</div>` : ''}
        </div>
      ` : ''}

      ${deliveryTasks.length ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:10px;">Delivery Tasks</div>
          <div style="display:grid; gap:10px;">
            ${deliveryTasks.map((task: any) => `
              <div style="border:1px solid #eadfcf; border-radius:12px; padding:12px;">
                <div style="font-weight:700;">${escapeHtml(String(task.direction || '').replace(/_/g, ' '))} · ${escapeHtml(String(task.status || '').replace(/_/g, ' '))}</div>
                <div style="margin-top:4px; color:#5f4e43;">${escapeHtml(task?.deliveryCompany?.name || 'Delivery partner')} · ${escapeHtml(money(task?.feeAmount, task?.currency || reservation?.currency))}</div>
                ${task?.addressLine1 ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml([task.addressLine1, task.addressLine2, task.landmark].filter(Boolean).join(', '))}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${ledgerLines.length ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:10px;">Ledger Lines</div>
          <div style="display:grid; gap:10px;">
            ${ledgerLines.map((line: any) => `
              <div style="border:1px solid #eadfcf; border-radius:12px; padding:12px;">
                <div style="font-weight:700;">${escapeHtml(line?.label || line?.entryType || 'Ledger line')}</div>
                <div style="margin-top:4px; color:#5f4e43;">${escapeHtml(money(line?.amount, line?.currency || reservation?.currency))} · ${escapeHtml(String(line?.direction || 'credit'))}${line?.isRefundable ? ' · Refundable' : ''}</div>
                ${(line?.beneficiaryType || line?.beneficiaryId) ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml([line.beneficiaryType, line.beneficiaryId].filter(Boolean).join(' · '))}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${reservation?.cancellationReason ? `
        <div style="padding:14px; background:#fff; border:1px solid #f0d8d5; border-radius:14px; margin-bottom:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#a05b55; margin-bottom:8px;">Cancellation Reason</div>
          <div style="color:#6d2f2a; white-space:pre-wrap;">${escapeHtml(reservation.cancellationReason)}</div>
        </div>
      ` : ''}

      ${reservation?.failedReason ? `
        <div style="padding:14px; background:#fff; border:1px solid #f0d8d5; border-radius:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#a05b55; margin-bottom:8px;">Failure Reason</div>
          <div style="color:#6d2f2a; white-space:pre-wrap;">${escapeHtml(reservation.failedReason)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

async function refreshReport(report: Report) {
  await report.$master?.$load();
  report.$master?.$set('reservationDetails', renderReservationHtml(report.$master?.$data || {}));
  report.forceRender();
}

async function patchReservation(reservationId: string, data: Record<string, unknown>) {
  await Api.instance.service(getServicePath()).patch(reservationId, data);
}

function reasonDialog(title: string, label: string, onSubmit: (reason: string) => Promise<void>) {
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title,
        width: 520,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label, storage: 'reason', type: 'textarea', required: true }),
            ],
          }),
        ],
        saved: async (form) => {
          const reason = String(form.$master?.$get('reason') || '').trim();
          if (!reason) {
            Dialogs.$error(`${label} is required.`);
            return;
          }
          await onSubmit(reason);
          dialog.forceCancel();
        },
      });
    },
  });

  return dialog;
}

function confirmButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Confirm', color: 'success' }, {
    onClicked: async (button) => {
      try {
        await patchReservation(String(button.$master?.$get('id') || ''), { reservationStatus: 'confirmed' });
        statusRef.value = 'confirmed';
        await refreshReport(report);
        Dialogs.$success('Reservation confirmed.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to confirm reservation.');
      }
    },
  });
}

function pickupButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Mark Picked Up', color: 'primary' }, {
    onClicked: async (button) => {
      try {
        await patchReservation(String(button.$master?.$get('id') || ''), { reservationStatus: 'picked_up' });
        statusRef.value = 'picked_up';
        await refreshReport(report);
        Dialogs.$success('Reservation marked picked up.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to update reservation.');
      }
    },
  });
}

function returnButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Mark Returned', color: 'secondary' }, {
    onClicked: async (button) => {
      try {
        await patchReservation(String(button.$master?.$get('id') || ''), { reservationStatus: 'returned' });
        statusRef.value = 'returned';
        await refreshReport(report);
        Dialogs.$success('Reservation completed.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to update reservation.');
      }
    },
  });
}

function cancelButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Cancel', color: 'warning' }, {
    onClicked: async (button) => {
      const dialog = reasonDialog('Cancel Reservation', 'Cancellation Reason', async (reason) => {
        try {
          await patchReservation(String(button.$master?.$get('id') || ''), {
            reservationStatus: 'cancelled',
            cancellationReason: reason,
          });
          statusRef.value = 'cancelled';
          await refreshReport(report);
          Dialogs.$success('Reservation cancelled.');
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to cancel reservation.');
        }
      });

      dialog.show();
    },
  });
}

function failButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Mark Failed', color: 'error' }, {
    onClicked: async (button) => {
      const dialog = reasonDialog('Mark Reservation Failed', 'Failure Reason', async (reason) => {
        try {
          await patchReservation(String(button.$master?.$get('id') || ''), {
            reservationStatus: 'failed',
            failedReason: reason,
          });
          statusRef.value = 'failed';
          await refreshReport(report);
          Dialogs.$success('Reservation marked failed.');
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to update reservation.');
        }
      });

      dialog.show();
    },
  });
}

function refundDepositButton(report: Report) {
  return $BN({ text: 'Refund Deposit', color: 'success' }, {
    onClicked: async (button) => {
      const dialog = reasonDialog('Refund Deposit', 'Resolution Reason', async (reason) => {
        try {
          await patchReservation(String(button.$master?.$get('id') || ''), {
            securityDepositAction: 'refund',
            securityDepositResolutionReason: reason,
          });
          await refreshReport(report);
          Dialogs.$success('Deposit refunded successfully.');
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to refund deposit.');
        }
      });

      dialog.show();
    },
  });
}

function deductDepositButton(report: Report) {
  return $BN({ text: 'Deduct Deposit', color: 'warning' }, {
    onClicked: async (button) => {
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Deduct Deposit',
            width: 560,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Deducted Amount', storage: 'securityDepositDeductedAmount', type: 'integer', required: true }),
                  $FD({ label: 'Resolution Reason', storage: 'securityDepositResolutionReason', type: 'textarea', required: true, cols: 12 }),
                  $FD({ label: 'Refund Reference', storage: 'securityDepositRefundReference', type: 'text', cols: 12 }),
                ],
              }),
            ],
            saved: async (form) => {
              const reason = String(form.$master?.$get('securityDepositResolutionReason') || '').trim();
              const deductedAmount = Number(form.$master?.$get('securityDepositDeductedAmount') || 0);

              if (!reason) {
                Dialogs.$error('Resolution Reason is required.');
                return;
              }

              if (!Number.isFinite(deductedAmount) || deductedAmount < 0) {
                Dialogs.$error('Deducted Amount must be zero or greater.');
                return;
              }

              try {
                await patchReservation(String(button.$master?.$get('id') || ''), {
                  securityDepositAction: 'deduct',
                  securityDepositDeductedAmount: deductedAmount,
                  securityDepositResolutionReason: reason,
                  securityDepositRefundReference: form.$master?.$get('securityDepositRefundReference'),
                });
                await refreshReport(report);
                Dialogs.$success('Deposit deduction saved successfully.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to deduct deposit.');
              }
            },
          });
        },
      });

      dialog.show();
    },
  });
}

const trigger = () => $TG({
  title: 'Reservations',
  selectFields: ['reservationNumber', 'customerDisplayName', 'fulfillmentMethod', 'startDate', 'endDate', 'totalAmount', 'currency', 'paymentStatus', 'reservationStatus', 'createdAt'],
  headers: [
    { title: 'Reservation', value: 'reservationNumber' },
    { title: 'Customer', value: 'customerDisplayName' },
    { title: 'Fulfilment', value: 'fulfillmentMethod' },
    { title: 'Start', value: 'startDate' },
    { title: 'End', value: 'endDate' },
    { title: 'Total', value: 'totalAmount' },
    { title: 'Currency', value: 'currency' },
    { title: 'Payment', value: 'paymentStatus' },
    { title: 'Status', value: 'reservationStatus' },
    { title: 'Created', value: 'createdAt' },
  ],
}, {});

const createForm = () => $FM({
  title: 'Reservation',
  width: 1200,
}, {
  children: () => [
    $PT({}, {
      children: () => [
        $FD({ label: 'Details', storage: 'reservationDetails', type: 'htmlview', readonly: true, cols: 12, minHeight: 520 }),
      ],
    }),
  ],
});

export const rentalReservationsReport = (reservationId?: string) => () => $RP({
  title: 'Reservation',
  fluid: true,
  sideButtonWidth: 220,
  ...(reservationId ? { objectId: reservationId, objectType: getServicePath() } : {}),
}, {
  form: createForm,
  loaded: async (report) => {
    if (report.$master?.$get('id')) {
      await refreshReport(report);
    }
  },
  sideButtons: (_props, _ctx, report) => {
    const statusRef: Ref<any> = ref(report.$master?.$get('reservationStatus'));
    const paymentStatus = String(report.$master?.$get('paymentStatus') || 'pending');
    const buttons: Button[] = [];

    if (paymentStatus === 'paid' && statusRef.value === 'requested') {
      buttons.push(confirmButton(report, statusRef));
    }

    if (paymentStatus === 'paid' && statusRef.value === 'confirmed') {
      buttons.push(pickupButton(report, statusRef));
    }

    if (paymentStatus === 'paid' && statusRef.value === 'picked_up') {
      buttons.push(returnButton(report, statusRef));
    }

    const depositAmount = Number(report.$master?.$get('securityDepositHeldAmount') || report.$master?.$get('securityDepositAmount') || 0);
    const depositStatus = String(report.$master?.$get('securityDepositStatus') || 'not_required');
    if (statusRef.value === 'returned' && depositAmount > 0 && ['held', 'not_required'].includes(depositStatus)) {
      buttons.push(refundDepositButton(report));
      buttons.push(deductDepositButton(report));
    }

    if (['requested', 'confirmed'].includes(String(statusRef.value || ''))) {
      buttons.push(cancelButton(report, statusRef));
      buttons.push(failButton(report, statusRef));
    }

    return buttons;
  },
  access: rentalAccess('rental.reservations.view'),
});

export const rentalReservationsCollection = () => $COL({
  objectType: getServicePath(),
}, {
  report: rentalReservationsReport(),
  trigger,
  access: rentalAccess('rental.reservations.view'),
});
