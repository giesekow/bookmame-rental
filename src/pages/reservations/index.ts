import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Button, DialogForm, Dialogs, Report } from 'vuetify-extended';
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

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateInput() {
  return formatDateInput(new Date());
}

function normalizeAttributes(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const label = String((item as any)?.label || '').trim();
        const attributeValue = String((item as any)?.value || '').trim();
        if (!label || !attributeValue) {
          return null;
        }
        return {
          key: label.toLowerCase(),
          label,
          value: attributeValue,
          sortOrder: typeof (item as any)?.sortOrder === 'number' ? (item as any).sortOrder : 100,
        };
      })
      .filter(Boolean) as Array<{ key: string; label: string; value: string; sortOrder: number }>;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([label, attributeValue], index) => {
        const normalizedLabel = String(label || '').trim();
        const normalizedValue = String(attributeValue ?? '').trim();
        if (!normalizedLabel || !normalizedValue) {
          return null;
        }
        return {
          key: normalizedLabel.toLowerCase(),
          label: normalizedLabel,
          value: normalizedValue,
          sortOrder: (index + 1) * 10,
        };
      })
      .filter(Boolean) as Array<{ key: string; label: string; value: string; sortOrder: number }>;
  }

  return [];
}

function mergeAttributes(baseValue: unknown, variantValue: unknown) {
  const items = new Map<string, { key: string; label: string; value: string; sortOrder: number }>();

  for (const attribute of normalizeAttributes(baseValue)) {
    items.set(attribute.key, attribute);
  }

  for (const attribute of normalizeAttributes(variantValue)) {
    items.set(attribute.key, attribute);
  }

  return [...items.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function renderAttributeSummary(baseValue: unknown, variantValue: unknown) {
  const pairs = mergeAttributes(baseValue, variantValue);
  if (!pairs.length) {
    return '';
  }

  return `
    <div style="margin-top:10px; display:grid; gap:8px;">
      ${pairs.map((pair, index) => `
        <div style="${index === 0 ? '' : 'padding-top:10px; border-top:1px solid rgba(133,101,71,0.14);'}">
          <div style="font-size:11px; letter-spacing:.05em; text-transform:uppercase; font-weight:700; color:#8a7768; margin-bottom:4px;">${escapeHtml(pair.label)}</div>
          <div style="font-size:13px; color:#241a14; word-break:break-word;">${escapeHtml(pair.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function rentalLedgerBeneficiaryLabel(reservation: any, line: any) {
  const beneficiaryType = String(line?.beneficiaryType || '').trim().toLowerCase();
  const beneficiaryId = String(line?.beneficiaryId || '').trim();

  if (beneficiaryType === 'rental_provider') {
    return useAppStore().rentalProvider?.name || 'Current provider';
  }

  if (beneficiaryType === 'delivery_company') {
    if (beneficiaryId && beneficiaryId === String(reservation?.deliveryCompany?.id || '')) {
      return reservation?.deliveryCompany?.name || 'Outbound delivery partner';
    }

    if (beneficiaryId && beneficiaryId === String(reservation?.returnDeliveryCompany?.id || '')) {
      return reservation?.returnDeliveryCompany?.name || 'Return delivery partner';
    }

    return reservation?.deliveryCompany?.name || reservation?.returnDeliveryCompany?.name || 'Delivery company';
  }

  if (beneficiaryType === 'customer') {
    const customerBits = [
      reservation?.customerDisplayName || 'Customer',
      reservation?.customerAccountId || '',
    ].filter(Boolean);
    return customerBits.join(' · ');
  }

  if (beneficiaryType === 'platform') {
    return 'Bookmame Platform';
  }

  return beneficiaryId || String(line?.beneficiaryType || 'Unknown beneficiary');
}

function rentalLedgerBeneficiaryMeta(line: any) {
  return String(line?.beneficiaryType || 'beneficiary').replace(/_/g, ' ');
}

function renderReservationHtml(reservation: any) {
  const deliveryTasks = Array.isArray(reservation?.deliveryTasks) ? reservation.deliveryTasks : [];
  const ledgerLines = Array.isArray(reservation?.ledgerLines) ? reservation.ledgerLines : [];
  const depositRefunds = Array.isArray(reservation?.depositRefunds) ? reservation.depositRefunds : [];
  const itemName = reservation?.itemNameSnapshot || reservation?.rentalInventoryItem?.name || 'Inventory item';
  const variantName = reservation?.variantNameSnapshot || reservation?.rentalInventoryVariant?.name || '';
  const categoryLabel = reservation?.itemCategoryLabelSnapshot || reservation?.rentalInventoryItem?.categoryLabel || '';
  const itemAttributes = typeof reservation?.itemAttributesSnapshot !== 'undefined'
    ? reservation.itemAttributesSnapshot
    : reservation?.rentalInventoryItem?.attributes;
  const variantAttributes = typeof reservation?.variantAttributesSnapshot !== 'undefined'
    ? reservation.variantAttributesSnapshot
    : reservation?.rentalInventoryVariant?.attributes;

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
          <div style="font-weight:700;">${escapeHtml(itemName)}</div>
          ${variantName ? `<div style="margin-top:4px; color:#5f4e43;">Variant: ${escapeHtml(variantName)}</div>` : ''}
          ${categoryLabel ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(categoryLabel)}</div>` : ''}
          ${renderAttributeSummary(itemAttributes, variantAttributes)}
          <div style="margin-top:4px; color:#5f4e43;">Qty: ${escapeHtml(reservation?.quantity || 1)}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Amount</div>
          <div style="font-weight:700;">${escapeHtml(money(reservation?.totalAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Payable now: ${escapeHtml(money(reservation?.paymentPayableAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Subtotal: ${escapeHtml(money(reservation?.subtotalAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Outbound delivery: ${escapeHtml(money(reservation?.outboundDeliveryFeeAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Return collection: ${escapeHtml(money(reservation?.returnDeliveryFeeAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit: ${escapeHtml(money(reservation?.securityDepositAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit collection: ${escapeHtml(String(reservation?.securityDepositCollectionMethod || 'not_required').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit status: ${escapeHtml(String(reservation?.securityDepositStatus || 'not_required').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit held: ${escapeHtml(money(reservation?.securityDepositHeldAmount, reservation?.currency))}</div>
          <div style="margin-top:4px; color:#5f4e43;">Deposit collected: ${escapeHtml(money(reservation?.securityDepositCollectedAmount, reservation?.currency))}</div>
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
          ${reservation?.paymentProviderOrderId ? `<div style="margin-top:4px; color:#5f4e43;">Provider Order ID: ${escapeHtml(reservation.paymentProviderOrderId)}</div>` : ''}
          ${reservation?.paymentReference ? `<div style="margin-top:4px; color:#5f4e43;">Reference: ${escapeHtml(reservation.paymentReference)}</div>` : ''}
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Fulfilment</div>
          <div style="font-weight:700;">${escapeHtml(String(reservation?.fulfillmentMethod || 'customer_pickup').replace(/_/g, ' '))}</div>
          ${reservation?.deliveryCompany?.name ? `<div style="margin-top:4px; color:#5f4e43;">Outbound: ${escapeHtml(reservation.deliveryCompany.name)}</div>` : ''}
          ${reservation?.fulfillmentMethod === 'customer_pickup' ? `<div style="margin-top:4px; color:#5f4e43;">Customer pickup handoff: ${escapeHtml(String(reservation?.customerPickupHandoffStatus || 'not_requested').replace(/_/g, ' '))}${reservation?.customerPickupHandoffCode && String(reservation?.customerPickupHandoffStatus || '') === 'requested' ? ` · PIN ${escapeHtml(reservation.customerPickupHandoffCode)}` : ''}</div>` : ''}
          <div style="margin-top:4px; color:#5f4e43;">Return: ${escapeHtml(String(reservation?.returnFulfillmentMethod || 'return_by_customer').replace(/_/g, ' '))}</div>
          ${reservation?.returnDeliveryCompany?.name ? `<div style="margin-top:4px; color:#5f4e43;">Return partner: ${escapeHtml(reservation.returnDeliveryCompany.name)}</div>` : ''}
          ${reservation?.returnFulfillmentMethod === 'return_by_customer' ? `<div style="margin-top:4px; color:#5f4e43;">Direct return handoff: ${escapeHtml(String(reservation?.customerReturnHandoffStatus || 'not_requested').replace(/_/g, ' '))}${reservation?.customerReturnHandoffCode && String(reservation?.customerReturnHandoffStatus || '') === 'requested' ? ` · PIN ${escapeHtml(reservation.customerReturnHandoffCode)}` : ''}</div>` : ''}
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
          ${reservation?.securityDepositCollectionReference ? `<div style="color:#5f4e43; margin-top:4px;">Collection Reference: ${escapeHtml(reservation.securityDepositCollectionReference)}</div>` : ''}
          ${reservation?.securityDepositRefundReference ? `<div style="color:#5f4e43; margin-top:4px;">Refund Reference: ${escapeHtml(reservation.securityDepositRefundReference)}</div>` : ''}
          ${reservation?.securityDepositResolvedAt ? `<div style="color:#5f4e43; margin-top:4px;">Resolved At: ${escapeHtml(dateTime(reservation.securityDepositResolvedAt))}</div>` : ''}
        </div>
      ` : ''}

      ${depositRefunds.length ? `
        <div style="padding:14px; background:#fff; border:1px solid #eadfcf; border-radius:14px; margin-bottom:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:10px;">Deposit Refund Activity</div>
          <div style="display:grid; gap:10px;">
            ${depositRefunds.map((refund: any) => `
              <div style="padding:12px; border:1px solid #eadfcf; border-radius:12px;">
                <div style="font-weight:700; color:#241a14;">${escapeHtml(String(refund?.status || 'pending').replace(/_/g, ' '))}</div>
                <div style="margin-top:4px; color:#5f4e43;">Requested: ${escapeHtml(money(refund?.requestedAmount, refund?.currency || reservation?.currency))}</div>
                ${Number(refund?.refundedAmount || 0) > 0 ? `<div style="margin-top:4px; color:#5f4e43;">Refunded: ${escapeHtml(money(refund?.refundedAmount, refund?.currency || reservation?.currency))}</div>` : ''}
                ${refund?.provider ? `<div style="margin-top:4px; color:#5f4e43;">Provider: ${escapeHtml(String(refund.provider).replace(/_/g, ' '))}</div>` : ''}
                ${refund?.providerMessage ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(refund.providerMessage)}</div>` : ''}
                ${refund?.manualReference ? `<div style="margin-top:4px; color:#5f4e43;">Reference: ${escapeHtml(refund.manualReference)}</div>` : ''}
                ${refund?.createdAt ? `<div style="margin-top:4px; color:#5f4e43;">Logged: ${escapeHtml(dateTime(refund.createdAt))}</div>` : ''}
              </div>
            `).join('')}
          </div>
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
                ${task?.pickupHandoffStatus ? `<div style="margin-top:4px; color:#5f4e43;">Pickup handoff: ${escapeHtml(String(task.pickupHandoffStatus || 'not_requested').replace(/_/g, ' '))}${task?.pickupHandoffCode && String(task.pickupHandoffStatus || '') === 'requested' ? ` · Rider PIN ${escapeHtml(task.pickupHandoffCode)}` : ''}</div>` : ''}
                ${task?.deliveryConfirmationStatus ? `<div style="margin-top:4px; color:#5f4e43;">Delivery confirmation: ${escapeHtml(String(task.deliveryConfirmationStatus || 'not_requested').replace(/_/g, ' '))}${task?.deliveryConfirmationCode && String(task.deliveryConfirmationStatus || '') === 'requested' ? ` · PIN ${escapeHtml(task.deliveryConfirmationCode)}` : ''}</div>` : ''}
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
                ${(line?.beneficiaryType || line?.beneficiaryId) ? `<div style="margin-top:4px; color:#5f4e43;">${escapeHtml(rentalLedgerBeneficiaryLabel(reservation, line))}</div>` : ''}
                ${(line?.beneficiaryType || line?.beneficiaryId) ? `<div style="margin-top:4px; color:#8a7768; font-size:12px; text-transform:uppercase; letter-spacing:.05em;">${escapeHtml(rentalLedgerBeneficiaryMeta(line))}</div>` : ''}
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

const fulfillmentOptions = [
  { id: 'customer_pickup', name: 'Customer pickup' },
  { id: 'partner_delivery', name: 'Partner delivery' },
  { id: 'third_party_delivery', name: 'Third-party delivery' },
];

const returnFulfillmentOptions = [
  { id: 'return_by_customer', name: 'Return by customer' },
  { id: 'partner_collection', name: 'Partner collection' },
  { id: 'third_party_collection', name: 'Third-party collection' },
];

async function configuredDeliveryPartnerOptions() {
  const response = await Api.instance.service(`rental-providers/${getRentalProviderId()}/delivery-partners`).find({
    query: {
      $paginate: false,
      $select: ['deliveryCompanyId', 'deliveryCompany.name', 'status', 'priorityRank'],
      $sort: {
        priorityRank: 1,
      },
    },
  }) as any;

  const items = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
  const normalized = items
    .filter((item: any) => String(item?.status || 'active').trim().toLowerCase() === 'active')
    .map((item: any) => ({
      id: item.deliveryCompanyId,
      name: item.deliveryCompany?.name || item.deliveryCompanyId,
    }));

  return [{ id: '', name: 'No delivery company selected' }, ...normalized];
}

export async function updateRentalReservationView(master: any) {
  await master?.$load?.();
  master?.$set?.('reservationDetails', renderReservationHtml(master?.$data || {}));
}

async function refreshReport(report: Report) {
  await updateRentalReservationView(report.$master);
  report.forceRender();
}

async function patchReservation(reservationId: string, data: Record<string, unknown>) {
  await Api.instance.service(getServicePath()).patch(reservationId, data);
}

function outboundTask(reservation: any) {
  return (Array.isArray(reservation?.deliveryTasks) ? reservation.deliveryTasks : []).find((task: any) =>
    String(task?.direction || '').trim().toLowerCase() === 'outbound',
  ) || null;
}

function returnTask(reservation: any) {
  return (Array.isArray(reservation?.deliveryTasks) ? reservation.deliveryTasks : []).find((task: any) =>
    String(task?.direction || '').trim().toLowerCase() === 'return',
  ) || null;
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

function notesDialog(title: string, initialNotes: string, onSubmit: (notes: string) => Promise<void>) {
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title,
        width: 560,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({
                label: 'Notes',
                storage: 'notes',
                type: 'textarea',
                required: false,
                cols: 12,
                hint: initialNotes
                  ? `Current notes: ${initialNotes}`
                  : 'Internal operational notes for this reservation.',
              }),
            ],
          }),
        ],
        saved: async (form) => {
          await onSubmit(String(form.$master?.$get('notes') || '').trim());
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
      const confirmed = await Dialogs.$confirm('Are you sure you want to confirm this reservation?');
      if (!confirmed) {
        return;
      }
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

function requestCustomerPickupButton(report: Report) {
  return $BN({ text: 'Ready for Pickup', color: 'primary' }, {
    onClicked: async (button) => {
      try {
        const confirmed = await Dialogs.$confirm(
          'Generate a customer pickup PIN and let the customer confirm receipt or share the PIN at handoff?',
          'Start Customer Pickup',
        );
        if (!confirmed) {
          return;
        }
        await Api.instance.service(`rental-providers/${getRentalProviderId()}/reservations/${String(button.$master?.$get('id') || '')}/customer-pickup/request`).create({});
        await refreshReport(report);
        Dialogs.$success('Customer pickup handoff started.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to start customer pickup.');
      }
    },
  });
}

function confirmCustomerPickupPinButton(report: Report) {
  return $BN({ text: 'Confirm Pickup PIN', color: 'success' }, {
    onClicked: async (button) => {
      const reservationId = String(button.$master?.$get('id') || '');
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Confirm Customer Pickup PIN',
            width: 420,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Customer PIN', storage: 'confirmationCode', type: 'text', required: true }),
                ],
              }),
            ],
            saved: async (form) => {
              try {
                await Api.instance.service(`rental-providers/${getRentalProviderId()}/reservations/${reservationId}/customer-pickup/confirm`).create({
                  confirmationCode: String(form.$master?.$get('confirmationCode') || '').trim(),
                });
                await refreshReport(report);
                Dialogs.$success('Customer pickup confirmed.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to confirm customer pickup PIN.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function requestOutboundPickupHandoffButton(report: Report) {
  return $BN({ text: 'Ready for Pickup', color: 'primary' }, {
    onClicked: async (button) => {
      const task = outboundTask(button.$master?.$data || {});
      if (!task?.id) {
        Dialogs.$error('No outbound delivery task is available for this reservation.');
        return;
      }
      try {
        const confirmed = await Dialogs.$confirm('Generate a rider pickup PIN and notify the assigned rider?', 'Start Pickup Handoff');
        if (!confirmed) {
          return;
        }
        await Api.instance.service(`rental-providers/${getRentalProviderId()}/delivery-tasks/${task.id}/pickup-handoff/request`).create({});
        await refreshReport(report);
        Dialogs.$success('Pickup handoff started.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to start pickup handoff.');
      }
    },
  });
}

function confirmOutboundPickupPinButton(report: Report) {
  return $BN({ text: 'Confirm Pickup PIN', color: 'success' }, {
    onClicked: async (button) => {
      const task = outboundTask(button.$master?.$data || {});
      if (!task?.id) {
        Dialogs.$error('No outbound delivery task is available for this reservation.');
        return;
      }
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Confirm Pickup PIN',
            width: 420,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Rider PIN', storage: 'confirmationCode', type: 'text', required: true }),
                ],
              }),
            ],
            saved: async (form) => {
              try {
                await Api.instance.service(`rental-providers/${getRentalProviderId()}/delivery-tasks/${task.id}/pickup-handoff/confirm`).create({
                  confirmationCode: String(form.$master?.$get('confirmationCode') || '').trim(),
                });
                await refreshReport(report);
                Dialogs.$success('Pickup handoff confirmed.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to confirm pickup PIN.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function confirmReturnedItemButton(report: Report) {
  return $BN({ text: 'Accept Returned Item', color: 'success' }, {
    onClicked: async (button) => {
      const task = returnTask(button.$master?.$data || {});
      if (!task?.id) {
        Dialogs.$error('No return delivery task is available for this reservation.');
        return;
      }
      try {
        const confirmed = await Dialogs.$confirm('Confirm that the returned rental item has been received back from the rider?', 'Accept Returned Item');
        if (!confirmed) {
          return;
        }
        await Api.instance.service(`rental-providers/${getRentalProviderId()}/delivery-tasks/${task.id}/delivery/confirm`).create({});
        await refreshReport(report);
        Dialogs.$success('Returned item accepted.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to confirm the returned item.');
      }
    },
  });
}

function confirmDirectReturnReceiptButton(report: Report) {
  return $BN({ text: 'Confirm Receipt', color: 'success' }, {
    onClicked: async (button) => {
      try {
        const confirmed = await Dialogs.$confirm(
          'Confirm that the returned item is now physically back with the rental provider?',
          'Confirm Receipt',
        );
        if (!confirmed) {
          return;
        }
        await Api.instance.service(`rental-providers/${getRentalProviderId()}/reservations/${String(button.$master?.$get('id') || '')}/return-handoff/confirm-receipt`).create({});
        await refreshReport(report);
        Dialogs.$success('Direct return receipt confirmed.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to confirm receipt.');
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

      AppManager.showDialog(dialog);
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

      AppManager.showDialog(dialog);
    },
  });
}

function refundDepositButton(report: Report) {
  return $BN({ text: 'Schedule Deposit Refund', color: 'success' }, {
    onClicked: async (button) => {
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Schedule Deposit Refund',
            width: 560,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Resolution Reason', storage: 'securityDepositResolutionReason', type: 'textarea', required: true, cols: 12 }),
                  $FD({ label: 'Refund Reference', storage: 'securityDepositRefundReference', type: 'text', cols: 12 }),
                ],
              }),
            ],
            saved: async (form) => {
              const reason = String(form.$master?.$get('securityDepositResolutionReason') || '').trim();

              if (!reason) {
                Dialogs.$error('Resolution Reason is required.');
                return;
              }

              try {
                await patchReservation(String(button.$master?.$get('id') || ''), {
                  securityDepositAction: 'refund',
                  securityDepositResolutionReason: reason,
                  securityDepositRefundReference: form.$master?.$get('securityDepositRefundReference'),
                });
                await refreshReport(report);
                Dialogs.$success('Deposit refund was scheduled.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to refund deposit.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function collectDepositButton(report: Report) {
  return $BN({ text: 'Record Deposit Collected', color: 'primary' }, {
    onClicked: async (button) => {
      const heldAmount = Number(button.$master?.$get('securityDepositAmount') || 0);
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Record Cash Deposit Collection',
            width: 560,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Collected Amount', storage: 'securityDepositCollectedAmount', type: 'integer', required: true }),
                  $FD({ label: 'Collection Reference', storage: 'securityDepositCollectionReference', type: 'text', cols: 12 }),
                  $FD({ label: 'Collection Note', storage: 'securityDepositCollectionNote', type: 'textarea', cols: 12 }),
                ],
              }),
            ],
            saved: async (form) => {
              const collectedAmount = Number(form.$master?.$get('securityDepositCollectedAmount') || heldAmount || 0);

              if (!Number.isFinite(collectedAmount) || collectedAmount <= 0) {
                Dialogs.$error('Collected Amount must be greater than zero.');
                return;
              }

              try {
                await patchReservation(String(button.$master?.$get('id') || ''), {
                  securityDepositAction: 'collect',
                  securityDepositCollectedAmount: collectedAmount,
                  securityDepositCollectionReference: form.$master?.$get('securityDepositCollectionReference'),
                  securityDepositCollectionNote: form.$master?.$get('securityDepositCollectionNote'),
                });
                await refreshReport(report);
                Dialogs.$success('Cash deposit collection recorded.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to record deposit collection.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function manualRefundDepositButton(report: Report) {
  return $BN({ text: 'Complete Manual Refund', color: 'secondary' }, {
    onClicked: async (button) => {
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Complete Manual Deposit Refund',
            width: 560,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Resolution Reason', storage: 'securityDepositResolutionReason', type: 'textarea', required: true, cols: 12 }),
                  $FD({ label: 'Refund Reference', storage: 'securityDepositRefundReference', type: 'text', cols: 12 }),
                ],
              }),
            ],
            saved: async (form) => {
              const reason = String(form.$master?.$get('securityDepositResolutionReason') || '').trim();
              if (!reason) {
                Dialogs.$error('Resolution Reason is required.');
                return;
              }

              try {
                await patchReservation(String(button.$master?.$get('id') || ''), {
                  securityDepositAction: 'manual_refund',
                  securityDepositResolutionReason: reason,
                  securityDepositRefundReference: form.$master?.$get('securityDepositRefundReference'),
                });
                await refreshReport(report);
                Dialogs.$success('Manual deposit refund completed.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to record manual refund.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
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

      AppManager.showDialog(dialog);
    },
  });
}

function updateNotesButton(report: Report) {
  return $BN({ text: 'Update Notes', color: 'info' }, {
    onClicked: async (button) => {
      const dialog = notesDialog(
        'Update Reservation Notes',
        String(button.$master?.$get('notes') || ''),
        async (notes) => {
          try {
            await patchReservation(String(button.$master?.$get('id') || ''), { notes });
            await refreshReport(report);
            Dialogs.$success('Reservation notes updated.');
          } catch (error: any) {
            Dialogs.$error(error?.message || 'Failed to update notes.');
          }
        },
      );

      AppManager.showDialog(dialog);
    },
  });
}

function editReservationButton(report: Report) {
  return $BN({ text: 'Edit Reservation', color: 'secondary' }, {
    onClicked: async (button) => {
      const current = button.$master?.$data || {};
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Edit Reservation',
            width: 680,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Customer Email', storage: 'customerEmail', type: 'text', cols: 6, hint: current.customerEmail || 'Leave blank to keep current value.' }),
                  $FD({ label: 'Customer Phone', storage: 'customerPhoneNumber', type: 'text', cols: 6, hint: current.customerPhoneNumber || 'Leave blank to keep current value.' }),
                  $FD({ label: 'Fulfilment Method', storage: 'fulfillmentMethod', type: 'select', cols: 6, hint: `Current: ${String(current.fulfillmentMethod || 'customer_pickup').replace(/_/g, ' ')}` }, {
                    selectOptions: async () => fulfillmentOptions,
                  }),
                  $FD({ label: 'Outbound Delivery Partner', storage: 'deliveryCompanyId', type: 'select', cols: 6, hint: current.deliveryCompany?.name ? `Current: ${current.deliveryCompany.name}` : 'Only used for third-party delivery.' }, {
                    selectOptions: configuredDeliveryPartnerOptions,
                  }),
                  $FD({ label: 'Return Method', storage: 'returnFulfillmentMethod', type: 'select', cols: 6, hint: `Current: ${String(current.returnFulfillmentMethod || 'return_by_customer').replace(/_/g, ' ')}` }, {
                    selectOptions: async () => returnFulfillmentOptions,
                  }),
                  $FD({ label: 'Return Delivery Partner', storage: 'returnDeliveryCompanyId', type: 'select', cols: 6, hint: current.returnDeliveryCompany?.name ? `Current: ${current.returnDeliveryCompany.name}` : 'Only used for third-party collection.' }, {
                    selectOptions: configuredDeliveryPartnerOptions,
                  }),
                ],
              }),
            ],
            saved: async (form) => {
              const fulfillmentMethod = String(form.$master?.$get('fulfillmentMethod') || current.fulfillmentMethod || 'customer_pickup');
              const returnFulfillmentMethod = String(form.$master?.$get('returnFulfillmentMethod') || current.returnFulfillmentMethod || 'return_by_customer');
              const deliveryCompanyId = fulfillmentMethod === 'third_party_delivery'
                ? String(form.$master?.$get('deliveryCompanyId') || '')
                : '';
              const returnDeliveryCompanyId = returnFulfillmentMethod === 'third_party_collection'
                ? String(form.$master?.$get('returnDeliveryCompanyId') || '')
                : '';

              try {
                await patchReservation(String(button.$master?.$get('id') || ''), {
                  customerEmail: String(form.$master?.$get('customerEmail') || '').trim() || current.customerEmail || undefined,
                  customerPhoneNumber: String(form.$master?.$get('customerPhoneNumber') || '').trim() || current.customerPhoneNumber || undefined,
                  fulfillmentMethod,
                  deliveryCompanyId: deliveryCompanyId || null,
                  returnFulfillmentMethod,
                  returnDeliveryCompanyId: returnDeliveryCompanyId || null,
                });
                dialog.forceCancel();
                await refreshReport(report);
                Dialogs.$success('Reservation details updated.');
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to update reservation.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function refreshButton(report: Report) {
  return $BN({ text: 'Refresh', color: 'secondary' }, {
    onClicked: async () => {
      try {
        await refreshReport(report);
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to refresh reservation.');
      }
    },
  });
}

const trigger = (defaultQuery: Record<string, any> = {}) => $TG({
  title: 'Reservations',
  selectFields: ['id','reservationNumber', 'customerDisplayName', 'fulfillmentMethod', 'startDate', 'endDate', 'totalAmount', 'currency', 'paymentStatus', 'reservationStatus', 'createdAt'],
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
  query: {
    ...defaultQuery,
  },
}, {
  format(trigger, items) {
    for (const item of items) {
      item.startDate = dateTime(item.startDate);
      item.endDate = dateTime(item.endDate);
      item.createdAt = dateTime(item.createdAt);
      item.fulfillmentMethod = String(item.fulfillmentMethod || 'customer_pickup').replace(/_/g, ' ');
      item.paymentStatus = String(item.paymentStatus || 'pending').replace(/_/g, ' ');
      item.reservationStatus = String(item.reservationStatus || 'requested').replace(/_/g, ' ');
      item.totalAmount = money(item.totalAmount, item.currency);
    }
    return items;
  },
  topChildren: () => [
    $FD({ label: 'Due From', type: 'date', storage: 'dueDateFrom', md: 4, lg: 3, hint: 'Filters reservations due from this pickup or delivery date.' }, {
      default() {
        return String(defaultQuery?.dueDateFrom || todayDateInput());
      },
    }),
    $FD({ label: 'Due To', type: 'date', storage: 'dueDateTo', md: 4, lg: 3, hint: 'Filters reservations due up to this pickup or delivery date.' }, {
      default() {
        return String(defaultQuery?.dueDateTo || todayDateInput());
      },
    }),
  ],
  processQuery(query, trigger) {
    const dueDateFrom = String(trigger.$master?.$get('dueDateFrom', String(defaultQuery?.dueDateFrom || todayDateInput())) || '').trim();
    const dueDateTo = String(trigger.$master?.$get('dueDateTo', String(defaultQuery?.dueDateTo || todayDateInput())) || '').trim();

    if (dueDateFrom) query.dueDateFrom = dueDateFrom;
    else delete query.dueDateFrom;

    if (dueDateTo) query.dueDateTo = dueDateTo;
    else delete query.dueDateTo;

    return query;
  },
});

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
  setup(report) {
    report.$set('isRentalReservationView', true);
  },
  loaded: async (report) => {
    report.$set('isRentalReservationView', true);
    if (report.$master?.$get('id')) {
      await refreshReport(report);
    }
  },
  sideButtons: (_props, _ctx, report) => {
    const statusRef: Ref<any> = ref(report.$master?.$get('reservationStatus'));
    const paymentStatus = String(report.$master?.$get('paymentStatus') || 'pending');
    const reservation = report.$master?.$data || {};
    const outbound = outboundTask(reservation);
    const inboundReturn = returnTask(reservation);
    const buttons: Button[] = [];

    buttons.push(refreshButton(report));
    buttons.push(updateNotesButton(report));

    if (['requested', 'confirmed'].includes(String(statusRef.value || '').trim().toLowerCase())) {
      buttons.push(editReservationButton(report));
    }

    if (paymentStatus === 'paid' && statusRef.value === 'requested') {
      buttons.push(confirmButton(report, statusRef));
    }

    if (
      paymentStatus === 'paid' &&
      statusRef.value === 'confirmed' &&
      String(reservation.fulfillmentMethod || '').trim().toLowerCase() === 'customer_pickup'
    ) {
      if (String(reservation.customerPickupHandoffStatus || 'not_requested').trim().toLowerCase() === 'not_requested') {
        buttons.push(requestCustomerPickupButton(report));
      }
      if (String(reservation.customerPickupHandoffStatus || '').trim().toLowerCase() === 'requested') {
        buttons.push(confirmCustomerPickupPinButton(report));
      }
    }

    if (
      paymentStatus === 'paid' &&
      statusRef.value === 'confirmed' &&
      outbound?.id &&
      String(outbound?.status || '').trim().toLowerCase() === 'assigned'
    ) {
      if (String(outbound?.pickupHandoffStatus || 'not_requested').trim().toLowerCase() === 'not_requested') {
        buttons.push(requestOutboundPickupHandoffButton(report));
      }
      if (String(outbound?.pickupHandoffStatus || '').trim().toLowerCase() === 'requested') {
        buttons.push(confirmOutboundPickupPinButton(report));
      }
    }

    if (
      paymentStatus === 'paid' &&
      statusRef.value === 'picked_up' &&
      String(reservation.returnFulfillmentMethod || '').trim().toLowerCase() === 'return_by_customer'
    ) {
      if (String(reservation.customerReturnHandoffStatus || '').trim().toLowerCase() === 'requested') {
        buttons.push(confirmDirectReturnReceiptButton(report));
      }
    }

    if (
      inboundReturn?.id &&
      String(inboundReturn?.status || '').trim().toLowerCase() === 'picked_up' &&
      String(inboundReturn?.deliveryConfirmationStatus || '').trim().toLowerCase() === 'requested'
    ) {
      buttons.push(confirmReturnedItemButton(report));
    }

    const requiredDepositAmount = Number(report.$master?.$get('securityDepositAmount') || 0);
    const heldDepositAmount = Number(report.$master?.$get('securityDepositHeldAmount') || 0);
    const depositStatus = String(report.$master?.$get('securityDepositStatus') || 'not_required').trim().toLowerCase();
    const depositCollectionMethod = String(report.$master?.$get('securityDepositCollectionMethod') || 'not_required').trim().toLowerCase();

    if (
      paymentStatus === 'paid' &&
      requiredDepositAmount > 0 &&
      depositCollectionMethod === 'cash' &&
      depositStatus === 'pending_collection'
    ) {
      buttons.push(collectDepositButton(report));
    }

    if (statusRef.value === 'returned' && heldDepositAmount > 0 && depositStatus === 'held') {
      buttons.push(refundDepositButton(report));
      buttons.push(deductDepositButton(report));
    }

    if (statusRef.value === 'returned' && heldDepositAmount > 0 && ['refund_failed', 'manual_refund_required'].includes(depositStatus)) {
      buttons.push(manualRefundDepositButton(report));
      buttons.push(refundDepositButton(report));
    }

    if (['requested', 'confirmed'].includes(String(statusRef.value || ''))) {
      buttons.push(cancelButton(report, statusRef));
      buttons.push(failButton(report, statusRef));
    }

    return buttons;
  },
  access: rentalAccess('rental.reservations.view'),
});

export const rentalReservationsCollection = (defaultQuery: Record<string, any> = {}) => $COL({
  objectType: getServicePath(),
}, {
  report: rentalReservationsReport(),
  trigger: () => trigger(defaultQuery),
  access: rentalAccess('rental.reservations.view'),
});
