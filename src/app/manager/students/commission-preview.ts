import type {CommissionOptions,CommissionContext,CommissionDraft} from '../student-operations/student-commission.types';
import {calculateCommission,commissionFacts,selectCommissionRule,rationalMinor} from './commission-preview-rules';
export interface PreviewLine{kind:string;amountMinor:number;itemCode:string;quantity:string;description:string;}
export type PreviewSnapshot=Pick<CommissionDraft['snapshot'],'calculation'|'taxMinor'|'totalMinor'|'value'|'noRevenue'|'warnings'>;
const scale=(v:string)=>{if(!/^\d{1,8}(\.\d{1,4})?$/.test(v))throw new Error('Confirm the tuition quantity and tax rate.');const [a,b='']=v.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));};
const decimal=(n:bigint)=>`${n/10000n}.${String(n%10000n).padStart(4,'0')}`;
export function previewCommission(options:CommissionOptions,lines:PreviewLine[],context:CommissionContext,saleId:string,advisor:string):PreviewSnapshot{
 if(options.issue)throw new Error(options.issue);
 if(!options.previewRules?.length)throw new Error('Commission settings are loading. Reopen the preview if they remain unavailable.');
 if(context.enrolmentDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(context.enrolmentDate)||!Number.isFinite(Date.parse(context.enrolmentDate))||new Date(context.enrolmentDate).toISOString().slice(0,10)!==context.enrolmentDate))throw new Error('Enter a valid original enrolment date.');
 const facts=commissionFacts(lines,context),rule=selectCommissionRule(options.previewRules,facts),calculation=calculateCommission(rule,lines,facts);
 const warnings:string[]=[],rep=options.trackingCategories?.filter(c=>c.name.trim().toLowerCase()==='sales representative')??[];
 const reps=rep[0]?.options.filter(o=>o.name.trim().toLowerCase()===advisor.trim().toLowerCase())??[];
 if(rep.length>1||rep.length===1&&reps.length!==1)throw new Error('Map the invoice advisor to one active PTY Sales Representative option.');
 if(!rep.length)warnings.push('Sales Representative is not in the active PTY catalogue. No advisor tracking will be sent.');
 let taxMinor=0;
 const revenue=calculation.components.map(component=>{
  const codes=[...new Set(lines.filter(l=>l.kind==='tuition').map(l=>l.itemCode.trim().toLowerCase()))];
  if(component.kind==='commission'&&(codes.length!==1||!codes[0]))throw new Error('Select one matching TRUST tuition item.');
  const code=component.kind==='cashback'?'cash back':codes[0],items=options.items?.filter(i=>i.code.trim().toLowerCase()===code&&options.accounts?.some(a=>a.code===i.accountCode))??[];
  if(items.length!==1)throw new Error(`Configure one PTY “${code}” item with a valid sales account.`);
  const item=items[0],taxes=options.taxRates?.filter(t=>t.taxType===item.taxType&&t.rate!==null)??[];
  if(taxes.length!==1)throw new Error(`Configure a valid tax default for PTY item “${item.code}”.`);
  const sale=options.typeOfSaleOptions?.filter(o=>component.kind==='cashback'?o.label.trim().toLowerCase()==='cash back':o.value===saleId)??[];
  if(sale.length!==1)throw new Error('Select an available Type of Sale for every PTY component.');
  let quantity='1',unitAmount=(component.amountMinor/100).toFixed(2);
  if(component.kind==='commission'){
   const q=lines.filter(l=>l.kind==='tuition'&&l.amountMinor>0).reduce((n,l)=>n+scale(l.quantity),0n);
   if(q<=0n)throw new Error('Confirm the TRUST tuition quantities.');
   const price=(BigInt(component.amountMinor)*1000000n+q/2n)/q;
   if(price<=0n||price>999999999999n||Number((q*price+500000n)/1000000n)!==component.amountMinor)throw new Error('The commission cannot retain the TRUST quantity and exact total at four decimal places. Review this instalment.');
   quantity=decimal(q);unitAmount=decimal(price);
  }
  component.taxMinor=rationalMinor(component.amountMinor,Number(scale(taxes[0].rate!)),1000000);taxMinor+=component.taxMinor;
  return {itemCode:item.code,accountCode:item.accountCode!,taxType:item.taxType!,quantity,unitAmount,description:component.kind==='commission'?lines.filter(l=>l.kind==='tuition').map(l=>l.description).join('\n'):`Enrolment cashback: ${lines[component.sourceLineIndexes[0]].description}`,tracking:[{name:'Type of Sale',option:sale[0].label},...(rep.length?[{name:rep[0].name,option:reps[0].name}]:[])]};
 });
 if(calculation.subtotalMinor+taxMinor>1000000000)throw new Error('Commission total exceeds the supported limit.');
 return {calculation,taxMinor,totalMinor:calculation.subtotalMinor+taxMinor,value:{lines:revenue},noRevenue:calculation.noRevenue,warnings};
}
