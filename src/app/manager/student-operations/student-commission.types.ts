import type {CaseInvoiceCatalogue} from './student-operations.types';
export interface CommissionOptions{
 available:boolean;issue:string|null;typeOfSaleOptions?:Array<{value:string;label:string}>;defaultTypeOfSaleOptionId?:string|null;typeOfSaleIssue?:string|null;collegeId?:string;collegeName?:string|null;
 rule?:{rule_id:string;commission_basis_points:number;application_conditions:string|null}|null;
 accounts?:CaseInvoiceCatalogue['accounts'];catalogue?:CaseInvoiceCatalogue|null;items?:CaseInvoiceCatalogue['items'];tax?:{taxType:string;name:string;rate:string|null}|null;
}
export interface CommissionDraft{
 sequence:number;revision:number;sourceHash:string;stale:boolean;adjustmentRequired:boolean;
 status:'not_attempted'|'creating'|'created'|'review_required'|null;invoiceId:string|null;invoiceNumber:string|null;
 trustConnectionId:string|null;trustInvoiceId:string|null;providerStatus:string|null;providerDate:string|null;providerDueDate:string|null;amountPaid:string|number|null;amountDue:string|number|null;
 snapshot:{connectionId:string;collegeId:string;collegeName:string;calculation:{tuitionMinor:number;basisPoints:number;commissionMinor:number};taxMinor:number;totalMinor:number;value:{lines:Array<{itemCode?:string;description?:string;quantity?:string;unitAmount?:string;accountCode?:string;taxType?:string;tracking?:Array<{name:string;option:string;trackingCategoryId?:string;trackingOptionId?:string}>}>}};
}
export interface InvoiceExportResult{created:number;skipped:number;results:Array<{sequence:number;status:string;invoiceId?:string;invoiceNumber?:string|null;errorCode?:string;message?:string}>;}
