export type Decision='eligible'|'uncertain'|'ineligible';
export interface ClaimReview {revision:number;decision:Decision;policy:string;date:string|null;actor:string}
export interface ClaimSource {kind:'cash'|'offset';id:string;label:string;available:number}
export interface CommissionClaim {
 history:ClaimReview[];issue:string|null;token:string|null;previewMinor:number|null;earnedMinor:number|null;stale:boolean;canCreate:boolean;
 calculation:{student:string;college:string;base:number;tax:number;total:number;rule:string}|null;
 link:{status:'submitted'|'linked';origin:string;id:string|null}|null;candidates:{id:string;label:string|null;status:string;paired:boolean;verified:boolean}[];
 totals:{cash:number;offset:number;outstanding:number;disputed:number;allocations:{id:string;source:string;kind:string;minor:number;actor:string;recordedAt:string}[];sources:ClaimSource[]}|null;
}
export type CommissionCommand =
 {requestId:string;revision:number;decision:Decision;policy:string;earnedOn:string|null;token:string|null} |
 {revision:number;action:'link'|'create';invoiceId:string|null} |
 {requestId:string;revision:number;kind:'cash'|'offset';source:string;minor:number};
