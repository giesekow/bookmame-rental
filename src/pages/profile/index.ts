import { $FD, $FM, $PT, $RP } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderProfileCard() {
  const provider = useAppStore().rentalProvider;

  if (!provider) {
    return `
      <div style="padding:18px; border:1px solid #eadfcf; border-radius:18px; background:#ffffff; color:#6f6258;">
        No rental provider is currently selected.
      </div>
    `;
  }

  const countries = Array.isArray(provider.countryOfOperationCodes) && provider.countryOfOperationCodes.length > 0
    ? provider.countryOfOperationCodes.join(', ')
    : 'Not configured';

  const address = [provider.addressLine1, provider.addressLine2, provider.landmark, provider.city]
    .filter((item) => String(item || '').trim().length > 0)
    .join(', ') || 'No address captured yet';

  return `
    <div style="display:grid; gap:16px; font-family:inherit;">
      <section style="background:#fff; border:1px solid #eadfcf; border-radius:20px; padding:20px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Rental Provider Profile</div>
        <div style="font-size:24px; font-weight:800; color:#241a14;">${escapeHtml(provider.name)}</div>
        <div style="margin-top:6px; font-size:14px; color:#5f4e43;">${escapeHtml(provider.description || 'No rental provider description yet.')}</div>
      </section>
      <section style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Status</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#241a14;">${escapeHtml(provider.status || 'unknown')}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Approval</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#241a14;">${escapeHtml(provider.approvalStatus || 'pending')}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Default Currency</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#241a14;">${escapeHtml(provider.defaultCurrencyCode || 'Not set')}</div>
        </div>
        <div style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Support Contact</div>
          <div style="margin-top:8px; font-size:16px; font-weight:700; color:#241a14;">${escapeHtml(provider.supportPhoneNumber || provider.supportEmail || 'Not set')}</div>
        </div>
      </section>
      <section style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Operating Countries</div>
        <div style="margin-top:8px; font-size:15px; color:#241a14;">${escapeHtml(countries)}</div>
      </section>
      <section style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Address</div>
        <div style="margin-top:8px; font-size:15px; color:#241a14;">${escapeHtml(address)}</div>
      </section>
    </div>
  `;
}

export const rentalProfileReport = () => $RP({ title: 'Rental Provider Profile' }, {
  form: () => $FM({ title: 'Rental Provider Profile', width: 1180 }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({
            label: 'Profile',
            storage: 'profileView',
            type: 'htmlview',
            readonly: true,
            cols: 12,
            minHeight: 620,
          }, {
            default() {
              return renderProfileCard();
            },
          }),
        ],
      }),
    ],
    setup(form) {
      form.$master?.$set('profileView', renderProfileCard());
    },
  }),
});
