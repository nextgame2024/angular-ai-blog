export interface ConsultationSlot {
  slotId:string;startsAt:string;startsAtLabel:string;adviserName:string;serviceName:string;
  meetingDetails:string;timeZone:string;isDemo:boolean;placesAvailable?:number;
}
export interface ConsultationReview extends ConsultationSlot {
  mode:'new'|'resend';bookingId?:string;confirmedStartsAt:string;customerName:string;customerEmail:string;
  includeSummary:boolean;enquirySummary:string;sourceLinks:string[];
}
export interface ConsultationBooking extends ConsultationSlot {
  bookingId:string;customerName:string;customerEmail:string;status:string;emailStatus:string;
}
export interface ConsultationView {slots?:ConsultationSlot[];review?:ConsultationReview;booking?:ConsultationBooking;message?:string;}
export const CONSULTATION_TOOLS=['getStudentConsultationSlots','reviewStudentConsultation','bookStudentConsultation','getStudentConsultationBooking','reviewStudentConsultationEmail','resendStudentConsultationEmail'];
const record=(v:unknown):Record<string,unknown>=>v && typeof v==='object' ? v as Record<string,unknown> : {};
const text=(v:unknown)=>typeof v==='string' ? v : '';
function slot(v:unknown):ConsultationSlot|null {
  const r=record(v);
  if(!['slotId','startsAt','startsAtLabel','adviserName','serviceName','meetingDetails','timeZone'].every(k=>typeof r[k]==='string') || typeof r['isDemo']!=='boolean')return null;
  return {slotId:text(r['slotId']),startsAt:text(r['startsAt']),startsAtLabel:text(r['startsAtLabel']),adviserName:text(r['adviserName']),serviceName:text(r['serviceName']),meetingDetails:text(r['meetingDetails']),timeZone:text(r['timeZone']),isDemo:r['isDemo'] as boolean};
}
export function consultationView(output:unknown):ConsultationView {
  const p=record(output);
  if(Array.isArray(p['consultationSlots']))return {slots:p['consultationSlots'].map(slot).filter((s):s is ConsultationSlot=>s!==null),message:text(p['message'])};
  const r=record(p['consultationReview']);const s=slot(r);
  if(s && (r['mode']==='new'||r['mode']==='resend') && text(r['customerName']) && text(r['customerEmail']))return {review:{...s,mode:r['mode'],bookingId:text(r['bookingId'])||undefined,confirmedStartsAt:text(r['confirmedStartsAt'])||s.startsAt,customerName:text(r['customerName']),customerEmail:text(r['customerEmail']),includeSummary:r['includeSummary']===true,enquirySummary:text(r['enquirySummary']),sourceLinks:Array.isArray(r['sourceLinks']) ? r['sourceLinks'].filter((v):v is string=>typeof v==='string') : []}};
  const b=record(p['consultationBooking']);const bs=slot(b);
  if(bs && text(b['bookingId']) && text(b['customerName']) && text(b['customerEmail']))return {booking:{...bs,bookingId:text(b['bookingId']),customerName:text(b['customerName']),customerEmail:text(b['customerEmail']),status:text(b['status']),emailStatus:text(b['emailStatus'])}};
  return {message:'Consultation details could not be loaded. Ask Sophia to check again.'};
}
export function consultationReviewInput(review:ConsultationReview):Record<string,unknown> {
  return review.mode==='resend' ? {bookingId:review.bookingId,customerEmail:review.customerEmail} : {
    slotId:review.slotId,confirmedStartsAt:review.confirmedStartsAt,customerName:review.customerName,
    customerEmail:review.customerEmail,includeSummary:review.includeSummary,
    enquirySummary:review.includeSummary ? review.enquirySummary : '',sourceLinks:review.includeSummary ? review.sourceLinks : [],
  };
}
