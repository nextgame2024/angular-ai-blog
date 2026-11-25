import type {CaseInvoiceCatalogue} from './student-operations.types';
export interface CommissionContext{classification?:'ELICOS'|'VET'|'HE';location?:'ON-SHORE'|'OFF-SHORE';program?:string;city?:string;enrolmentDate?:string;trimester?:number;courseMonth?:number;isBulk?:boolean;}
export interface CommissionConfiguration{version:2;state:'ready'|'blocked';blockedReason:string|null;city:string|null;effectiveFrom:string|null;effectiveTo:string|null;dateBasis:'enrolment_date'|null;rateNumerator:number;rateDenominator:number;rateMethod:'fixed'|'trimester'|'first_month';laterRateNumerator:number;nonBulkOnly:boolean;cashback:{mode:'none'|'enrolment_gross'|'fixed_net';amountMinor:number};}
export interface PreviewCommissionRule{rule_id:string;active:boolean;classification:string|null;location:string|null;program:string|null;configuration:CommissionConfiguration;}
export interface CommissionOptions{
 previewRules?:PreviewCommissionRule[];taxRates?:Array<{taxType:string;name:string;rate:string|null}>;trackingCategories?:Array<{name:string;trackingCategoryId:string;options:Array<{name:string;trackingOptionId:string}>}>;
 advanced?:boolean;requiredContext?:Partial<Record<keyof CommissionContext,boolean>>|null;
 available:boolean;issue:string|null;typeOfSaleOptions?:Array<{value:string;label:string}>;defaultTypeOfSaleOptionId?:string|null;typeOfSaleIssue?:string|null;collegeId?:string;collegeName?:string|null;
 rule?:{rule_id:string;commission_basis_points:number;application_conditions:string|null}|null;
 accounts?:CaseInvoiceCatalogue['accounts'];catalogue?:CaseInvoiceCatalogue|null;items?:CaseInvoiceCatalogue['items'];tax?:{taxType:string;name:string;rate:string|null}|null;
}
export interface CommissionDraft{
 calculationHash?:string;sequence:number;revision:number;sourceHash:string;stale:boolean;adjustmentRequired:boolean;
 status:'not_attempted'|'creating'|'created'|'review_required'|null;invoiceId:string|null;invoiceNumber:string|null;
 trustConnectionId:string|null;trustInvoiceId:string|null;providerStatus:string|null;providerDate:string|null;providerDueDate:string|null;amountPaid:string|number|null;amountDue:string|number|null;
 snapshot:{schemaVersion?:2;context?:CommissionContext;noRevenue?:boolean;warnings?:string[];connectionId:string;collegeId:string;collegeName:string;calculation:{tuitionMinor:number;basisPoints:number;commissionMinor:number;subtotalMinor?:number;rateNumerator?:number;rateDenominator?:number;components?:Array<{key:string;kind:string;amountMinor:number;taxMinor?:number;sourceLineIndexes:number[]}>};taxMinor:number;totalMinor:number;value:{lines:Array<{itemCode?:string;description?:string;quantity?:string;unitAmount?:string;accountCode?:string;taxType?:string;tracking?:Array<{name:string;option:string;trackingCategoryId?:string;trackingOptionId?:string}>}>}};
}
export interface InvoiceExportResult{created:number;skipped:number;results:Array<{sequence:number;status:string;invoiceId?:string;invoiceNumber?:string|null;errorCode?:string;message?:string}>;}
