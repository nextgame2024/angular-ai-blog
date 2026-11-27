import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'xeroReviewUrl'})
export class XeroReviewUrlPipe implements PipeTransform {
  transform(id: string, resource: 'invoice' | 'payment', shortCode: string | null): string | null {
    if (!shortCode || !/^!?[A-Za-z0-9_-]+$/.test(shortCode) ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;

    if (resource === 'invoice') return `https://go.xero.com/app/${shortCode}/invoicing/view/${id}`;
    const url = new URL('https://go.xero.com/organisationlogin/default.aspx');
    url.searchParams.set('shortcode', shortCode);
    url.searchParams.set('redirecturl', `/Bank/ViewTransaction.aspx?bankTransactionID=${id}`);
    return url.href;
  }
}
