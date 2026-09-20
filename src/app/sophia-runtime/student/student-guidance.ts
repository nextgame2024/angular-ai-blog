import {CONSULTATION_TOOLS} from './student-consultation';
export interface StudentSource { title: string; url: string; checkedAt: string | null; status: string; }
export interface StudentCard {
  kind: string; title: string; summary: string; evidenceStatus: string;
  verifiedAt: string | null; previousRule: string | null; currentRule: string | null;
  newStudentImpact: string | null; currentStudentImpact: string | null;
  effectiveFrom: string | null; effectiveTo: string | null; changeStatus: string;
  applicability: string[]; limitations: string[]; sources: StudentSource[];
}
export interface StudentGuidanceView {title: string; notice: string; cards: StudentCard[];}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const date = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) && Number.isFinite(Date.parse(value)) ? (value.length === 10 ? `${value}T00:00:00Z` : value) : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const plainText = (value: unknown): string => text(value)
  .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, '$1')
  .replace(/<https?:\/\/[^>]+>/g, '')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/\*\*|__|[*_`#]/g, '')
  .replace(/^\s*[-+]\s+/gm, '')
  .replace(/\s*\n+\s*/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();
const hosts = new Set(['immi.homeaffairs.gov.au','www.homeaffairs.gov.au','www.education.gov.au','www.studyaustralia.gov.au','www.legislation.gov.au','www.mara.gov.au']);
function safeUrl(value: unknown): string | null {
  try { const url=new URL(text(value)); return url.protocol==='https:' && !url.username && !url.password && !url.port && hosts.has(url.hostname) ? url.href : null; } catch { return null; }
}
export function studentGuidanceView(output: unknown): StudentGuidanceView {
  const payload=record(output); const view=record(payload['studentView']);
  const cards = Array.isArray(view['cards']) ? view['cards'].slice(0,8).map(value => {
    const card=record(value);
    const sources: StudentSource[] = [];
    for (const item of Array.isArray(card['sources']) ? card['sources'] : []) {
      const source=record(item);const url=safeUrl(source['url']);
      if(url) sources.push({title:text(source['title'])||'Official source',url,checkedAt:date(source['checkedAt']),status:text(source['status'])});
    }
    return {kind:text(card['kind']),title:plainText(card['title']),summary:plainText(card['summary']),
      evidenceStatus:['live','reviewed','cached','unavailable'].includes(text(card['evidenceStatus'])) ? text(card['evidenceStatus']) : 'unavailable',
      verifiedAt:date(card['verifiedAt']),previousRule:text(card['previousRule'])||null,currentRule:text(card['currentRule'])||null,
      newStudentImpact:text(card['newStudentImpact'])||null,currentStudentImpact:text(card['currentStudentImpact'])||null,
      effectiveFrom:date(card['effectiveFrom']),effectiveTo:date(card['effectiveTo']),changeStatus:text(card['changeStatus']),
      applicability:strings(card['applicability']),limitations:strings(card['limitations']),sources};
  }).filter(card=>card.title) : [];
  return {title:text(view['title'])||'Student information',notice:text(view['notice'])||'No verified answer is available for this request. Sophia can explain what still needs checking.',cards};
}
export function guidanceDomain(tool: string): 'student' | 'property' | null {
  if(CONSULTATION_TOOLS.includes(tool))return 'student';
  if(['searchStudentAgencyKnowledge','verifyStudentRules','compareStudentRules','closeStudentView'].includes(tool))return 'student';
  if(['searchProperties','getPropertyDetails','showPropertyPhoto','closePropertyView','getInspectionSlots','reviewInspectionBooking','reviewInspectionEmailResend','bookInspection','resendInspectionConfirmation','searchAgencyKnowledge'].includes(tool))return 'property';
  return null;
}
