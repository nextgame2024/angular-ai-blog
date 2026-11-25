// Browser preview only. The server independently validates and recalculates before persistence.
import type {CommissionContext,CommissionConfiguration,PreviewCommissionRule as CommissionRule} from '../student-operations/student-commission.types';
type SourceLine={kind?:unknown;amountMinor?:unknown;itemCode?:unknown};
export type CommissionComponent={key:string;kind:'commission'|'cashback';sourceLineIndexes:number[];baseMinor:number;amountMinor:number;rateNumerator:number;rateDenominator:number;itemId?:string;taxMinor?:number};
const normal=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLowerCase();

export function configuredRule(rule:CommissionRule):CommissionConfiguration {
 const c=rule.configuration;
 if(!c||c.version!==2||!['ready','blocked'].includes(c.state)||!['fixed','trimester','first_month'].includes(c.rateMethod)||![c.rateNumerator,c.rateDenominator,c.laterRateNumerator].every(Number.isSafeInteger)||c.rateNumerator<0||c.rateDenominator<1||c.rateNumerator>c.rateDenominator||!c.cashback)throw new Error('Reload the commission configuration before calculating.');
 return c;
}

export function commissionFacts(lines:SourceLine[],provided:CommissionContext):CommissionContext {
 const v={...provided},tuition=lines.filter(l=>l.kind==='tuition');
 const codes=tuition.map(l=>normal(l.itemCode));
 const classifications=new Set(codes.map(c=>c.includes('elicos')?'ELICOS':/\bvet\b/.test(c)?'VET':c.includes('higher education')||/\bhe\b/.test(c)?'HE':null).filter(Boolean));
 const locations=new Set(codes.map(c=>c.includes('on-shore')?'ON-SHORE':c.includes('off-shore')?'OFF-SHORE':null).filter(Boolean));
 if(classifications.size>1||locations.size>1)throw new Error('Use one course classification and student location per TRUST invoice.');
 const classification=[...classifications][0] as CommissionContext['classification'],location=[...locations][0] as CommissionContext['location'];
 if(classification&&v.classification&&classification!==v.classification||location&&v.location&&location!==v.location)throw new Error('Commission course facts must agree with the TRUST tuition item.');
 return {...v,...classification?{classification}:{},...location?{location}:{}};
}

export function selectCommissionRule(rules:CommissionRule[],facts:CommissionContext):CommissionRule {
 const active=rules.filter(r=>r.active);
 if(!active.length)throw new Error('Record an active college commission rule before preparing PTY invoices.');
 const states=active.map(rule=>{
  const c=configuredRule(rule);let unknown=false,matches=true;
  for(const [expected,actual] of [[rule.classification,facts.classification],[rule.location,facts.location],[rule.program,facts.program],[c.city,facts.city]]){
   if(!expected)continue;if(!actual)unknown=true;else if(normal(expected)!==normal(actual))matches=false;
  }
  if(c.effectiveFrom||c.effectiveTo){if(!facts.enrolmentDate)unknown=true;else if(c.effectiveFrom&&facts.enrolmentDate<c.effectiveFrom||c.effectiveTo&&facts.enrolmentDate>c.effectiveTo)matches=false;}
  return {rule,c,unknown,matches};
 });
 if(states.some(s=>s.matches&&s.unknown))throw new Error('Complete the course classification, student location, program and original enrolment date required by the college rules.');
 const matched=states.filter(s=>s.matches&&!s.unknown);
 if(!matched.length)throw new Error('No college commission rule matches these course facts. Review the college configuration.');
 const narrower=(a:typeof matched[number],b:typeof matched[number])=>{
  const aa=[a.rule.classification,a.rule.location,a.rule.program,a.c.city],bb=[b.rule.classification,b.rule.location,b.rule.program,b.c.city];
  const contained=bb.every((v,i)=>!v||normal(v)===normal(aa[i]))&&(a.c.effectiveFrom??'0001-01-01')>=(b.c.effectiveFrom??'0001-01-01')&&(a.c.effectiveTo??'9999-12-31')<=(b.c.effectiveTo??'9999-12-31');
  return contained&&(aa.some((v,i)=>Boolean(v)&&!bb[i])||a.c.effectiveFrom!==b.c.effectiveFrom||a.c.effectiveTo!==b.c.effectiveTo);
 };
 const winners=matched.filter(a=>!matched.some(b=>a!==b&&narrower(b,a)));
 if(winners.length!==1)throw new Error('Multiple college commission rules match. Resolve the conflicting conditions before creating PTY.');
 if(winners[0].c.state==='blocked')throw new Error(winners[0].c.blockedReason!);
 return winners[0].rule;
}

export function rationalMinor(base:number,numerator:number,denominator:number):number {
 if(!Number.isSafeInteger(base)||base<0||base>1_000_000_000||!Number.isSafeInteger(numerator)||numerator<0||!Number.isSafeInteger(denominator)||denominator<1)throw new Error('Check the commission base and exact rate.');
 const n=BigInt(base)*BigInt(numerator),d=BigInt(denominator),result=Number((n*2n+d)/(2n*d));
 if(!Number.isSafeInteger(result)||result>1_000_000_000)throw new Error('Commission exceeds the supported amount.');
 return result;
}

export function calculateCommission(rule:CommissionRule,lines:SourceLine[],facts:CommissionContext){
 const c=configuredRule(rule);
 if(c.state==='blocked')throw new Error(c.blockedReason!);
 if(c.nonBulkOnly&&facts.isBulk!==false)throw new Error('Confirm this is a normal, non-bulk enrolment before calculating commission.');
 let numerator=c.rateNumerator,denominator=c.rateDenominator;
 if(c.rateMethod==='trimester'){
  if(!Number.isSafeInteger(facts.trimester)||facts.trimester!<1)throw new Error('Enter the confirmed trimester number (1 or greater).');
  numerator=facts.trimester!<=2?20:facts.trimester!<=4?15:0;denominator=100;
 }
 if(c.rateMethod==='first_month'){if(!Number.isSafeInteger(facts.courseMonth)||facts.courseMonth!<1)throw new Error('Enter the confirmed course month (1 or greater).');if(facts.courseMonth!==1)numerator=c.laterRateNumerator;}
 const tuition=lines.map((l,i)=>({...l,index:i})).filter(l=>l.kind==='tuition');
 if(!tuition.length||tuition.some(l=>!Number.isSafeInteger(l.amountMinor)||Number(l.amountMinor)<0))throw new Error('Confirm the invoiced tuition before discounts.');
 const tuitionMinor=tuition.reduce((n,l)=>n+Number(l.amountMinor),0),commissionMinor=rationalMinor(tuitionMinor,numerator,denominator);
 const components:CommissionComponent[]=[];
 if(commissionMinor>0)components.push({key:'tuition',kind:'commission',sourceLineIndexes:tuition.map(l=>l.index),baseMinor:tuitionMinor,amountMinor:commissionMinor,rateNumerator:numerator,rateDenominator:denominator});
 if(c.cashback.mode!=='none')for(const [index,l] of lines.entries()){
  if(l.kind!=='enrolment')continue;
  if(!Number.isSafeInteger(l.amountMinor)||Number(l.amountMinor)<0)throw new Error('Check the eligible enrolment fee.');
  if(!l.amountMinor)continue;
  const amountMinor=c.cashback.mode==='fixed_net'?c.cashback.amountMinor:rationalMinor(Number(l.amountMinor),10,11);
  if(amountMinor>0)components.push({key:`enrolment:${index}`,kind:'cashback',sourceLineIndexes:[index],baseMinor:Number(l.amountMinor),amountMinor,rateNumerator:c.cashback.mode==='fixed_net'?0:10,rateDenominator:c.cashback.mode==='fixed_net'?1:11});
 }
 const subtotalMinor=components.reduce((n,c)=>n+c.amountMinor,0);
 if(subtotalMinor>1_000_000_000)throw new Error('Commission exceeds the supported amount.');
 return {tuitionMinor,basisPoints:numerator*10000/denominator,commissionMinor,subtotalMinor,rateNumerator:numerator,rateDenominator:denominator,rounding:'half_up_per_instalment' as const,components,noRevenue:components.length===0};
}
