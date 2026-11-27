import { TestBed } from '@angular/core/testing';
import { of,throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptAccountPanel } from './trust-receipt-account.component';

describe('TRUST receipt account mapping',()=>{
  const catalogue={revision:0,catalogueRevision:5,fresh:true,active:false,accounts:[{id:'bank',name:'Trust'}],history:[]};
  const mapped={...catalogue,revision:1,active:true,history:[{revision:1,receiptLabel:'Test TRUST',accountId:'bank',accountName:'Trust'}]};
  function setup() {
    const read=jasmine.createSpy().and.returnValues(of(catalogue),of(mapped),of(catalogue));
    const write=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({revision:1}),of({revision:2}));
    TestBed.configureTestingModule({imports:[TrustReceiptAccountPanel],providers:[{provide:StudentOperationsService,
      useValue:{trustReceiptAccount:read,changeTrustReceiptAccount:write}}]});
    const fixture=TestBed.createComponent(TrustReceiptAccountPanel);
    fixture.componentRef.setInput('connection','trust');fixture.detectChanges();
    const click=(label:string)=>{Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!.click();fixture.detectChanges();};
    return {fixture,panel:fixture.componentInstance,read,write,click};
  }
  it('requires an explicit account and reason, reuses the retry key and permits removal',()=>{
    const {fixture,panel,read,write,click}=setup();
    expect(read).not.toHaveBeenCalled();click('TRUST receipt account');
    expect(panel.account).toBe('');click('Save account mapping');expect(write).not.toHaveBeenCalled();
    panel.label='Test TRUST';panel.account='bank';panel.reason='Checked';fixture.detectChanges();
    click('Save account mapping');click('Save account mapping');
    expect(write.calls.argsFor(0)).toEqual(write.calls.argsFor(1));
    expect(write.calls.first().args[1]).toEqual(jasmine.objectContaining({revision:0,catalogueRevision:5,accountId:'bank',receiptLabel:'Test TRUST'}));
    expect(fixture.nativeElement.textContent).toContain('Current mapping');
    panel.reason='Retired account';fixture.detectChanges();click('Remove account mapping');
    expect(write.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({revision:1,accountId:null,receiptLabel:null}));
  });
  it('clears stale choices on refresh and resets when the organisation changes',()=>{
    const {fixture,panel,read,click}=setup();
    read.and.returnValue(of({...mapped,fresh:false,active:false}));click('TRUST receipt account');
    expect(panel.account).toBe('');expect(fixture.nativeElement.textContent).not.toContain('Save account mapping');
    expect(fixture.nativeElement.textContent).toContain('Remove account mapping');
    fixture.componentRef.setInput('connection','different');fixture.detectChanges();expect(panel.open).toBeFalse();
  });
  it('fits the account picker at narrow and desktop widths in both themes',()=>{
    const {fixture,click}=setup();click('TRUST receipt account');
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('button,input,textarea')) {
            const rect=control.getBoundingClientRect();if (rect.width) expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });
});
