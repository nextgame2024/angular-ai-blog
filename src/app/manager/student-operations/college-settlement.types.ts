export type SettlementKind='direct_proof'|'direct_confirmation'|'agency_payment'|'applied_refund'|'unapplied_refund';
export interface CollegeObligationInput {
  offer?:string|null;collegeId:string;scheduleId:string|null;instalment:string;policy:string;method:'gross'|'net';
  gross:string;offsetLimit:string;due:string;funding:string|null;bill:string|null;
}
export interface CollegeEventInput {
  document?:string|null;kind:SettlementKind;proof:string|null;amount:string;offset:string;date:string;reference:string;evidence:string;
}
export interface CollegeObligation extends Pick<CollegeObligationInput,'instalment'|'policy'|'method'|'gross'|'offsetLimit'|'due'|'funding'|'bill'> {
  id:string;billId:string|null;college:string;cash:string;usedOffset:string;balance:string;refunded:string;unapplied:string;
  review:boolean;fundingRisk:boolean;trustDue:string|null;direct:string;
}
export interface CollegeSettlementData {
  offers:{value:string;label:string;collegeId:string}[];documents:{value:string;label:string}[];row:CollegeObligation|null;total:number;colleges:{value:string;label:string}[];schedules:{value:string;label:string}[];
}
export interface CollegeEvent extends Omit<CollegeEventInput,'document'> { document?:{id:string;name:string}|null; id:string;remaining:string|null;actor:string }
export interface CollegeQueue {total:number;rows:{id:string;caseId:string;caseNumber:string;college:string;instalment:string;due:string;balance:string;unapplied:string;review:boolean;fundingRisk:boolean}[]}
