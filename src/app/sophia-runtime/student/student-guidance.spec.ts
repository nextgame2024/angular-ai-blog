import { TestBed } from '@angular/core/testing';
import { studentGuidanceView, guidanceDomain } from './student-guidance';
import { StudentGuidancePanelComponent } from './student-guidance-panel.component';

describe('Student guidance cards',()=>{
  it('rejects unsafe links and invalid dates',()=>{
    const view=studentGuidanceView({studentView:{cards:[{title:'Example',verifiedAt:'invalid',sources:[{url:'javascript:alert(1)'},{url:'https://immi.homeaffairs.gov.au.evil.test/'},{title:'Official',url:'https://immi.homeaffairs.gov.au/'}]}]}});
    expect(view.cards[0].sources.length).toBe(1);
    expect(view.cards[0].verifiedAt).toBeNull();
  });
  it('renders an announced comparison, unknown impacts and dated evidence honestly',()=>{
    const fixture=TestBed.createComponent(StudentGuidancePanelComponent);
    fixture.componentInstance.view=studentGuidanceView({studentView:{title:'What changed?',cards:[{kind:'comparison',title:'Example',summary:'Example only',changeStatus:'announced',evidenceStatus:'cached',previousRule:'Earlier rule',currentRule:'Proposed rule',effectiveFrom:'2027-01-01',sources:[]}]}});
    fixture.detectChanges();
    const content=fixture.nativeElement.textContent;
    expect(content).toContain('Announced — not yet in force');
    expect(content).toContain('Saved source — live check unavailable');
    expect(content).toContain('Do not assume an exemption');
    expect(content).toContain('1 Jan 2027');
  });
  it('provides an accessible close control and emits its action',()=>{
    const fixture=TestBed.createComponent(StudentGuidancePanelComponent);
    fixture.componentInstance.view=studentGuidanceView({});
    const close=spyOn(fixture.componentInstance.closeView,'emit');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Close student information"]').click();
    expect(close).toHaveBeenCalled();
  });
  it('shows web research as plain text while keeping official source links separate',()=>{
    const view=studentGuidanceView({studentView:{cards:[{
      title:'**Visa documents**',
      summary:'Use the **official checklist** at [Home Affairs](https://immi.homeaffairs.gov.au/example?utm_source=openai).',
      evidenceStatus:'live',
      sources:[{title:'Home Affairs',url:'https://immi.homeaffairs.gov.au/example'}],
    }]}});
    expect(view.cards[0].title).toBe('Visa documents');
    expect(view.cards[0].summary).toBe('Use the official checklist at Home Affairs.');
    expect(view.cards[0].sources[0].url).toBe('https://immi.homeaffairs.gov.au/example');
  });
  it('distinguishes property and student tools',()=>{
    expect(guidanceDomain('getInspectionSlots')).toBe('property');
    expect(guidanceDomain('compareStudentRules')).toBe('student');
    expect(guidanceDomain('searchStudentAgencyKnowledge')).toBe('student');
  });
});
