import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseDocumentActionsComponent } from './case-document-actions.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentDocumentType } from '../student-operations/student-operations.types';

describe('CaseDocumentActionsComponent',()=>{
  const type:StudentDocumentType={documentTypeId:'type-1',name:'Passport',required:true,status:'active',recordVersion:1};
  let api:any;
  beforeEach(async()=>{
    api={documentTypes:jasmine.createSpy().and.returnValue(of({types:[type]})),
      caseDocumentUploadOptions:jasmine.createSpy().and.returnValue(of({enabled:true,available:true})),
      createDocumentType:jasmine.createSpy().and.callFake((value:any)=>of({...type,...value,documentTypeId:'type-2'})),
      updateDocumentType:jasmine.createSpy().and.callFake((id:string,value:any)=>of({...type,...value,documentTypeId:id,recordVersion:2})),
      uploadCaseDocument:jasmine.createSpy().and.returnValue(of({documentId:'document-1'}))};
    await TestBed.configureTestingModule({imports:[CaseDocumentActionsComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(){const fixture=TestBed.createComponent(CaseDocumentActionsComponent);fixture.componentRef.setInput('caseId','case-1');fixture.componentRef.setInput('canManage',true);fixture.detectChanges();return fixture;}
  it('does not fetch types on ordinary page viewing and disables upload for an unsaved case',()=>{
    const f=setup();expect(api.documentTypes).not.toHaveBeenCalled();
    f.componentRef.setInput('caseId','');f.detectChanges();
    expect([...(f.nativeElement.querySelectorAll('.toolbar button') as NodeListOf<HTMLButtonElement>)].every(b=>b.disabled)).toBeTrue();
    f.componentInstance.open('upload');expect(api.documentTypes).not.toHaveBeenCalled();
    f.componentRef.setInput('canManage',false);f.detectChanges();expect(f.nativeElement.querySelector('.toolbar')).toBeNull();
  });
  it('opens a native modal and validates add/duplicate names without saving',()=>{
    const f=setup(),c=f.componentInstance;c.open('types');f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.modal.nativeElement.getAttribute('aria-labelledby')).toBe('document-modal-title');
    expect(f.nativeElement.querySelector('dialog header p').textContent).toBe('Manage the document types available to your company.');
    expect(f.nativeElement.textContent).not.toContain('future workflow checklist');
    c.saveType();expect(c.typeForm.controls.name.touched).toBeTrue();expect(api.createDocumentType).not.toHaveBeenCalled();
    c.typeForm.setValue({name:'  PASSPORT  ',required:'no'});c.saveType();expect(c.message).toContain('already exists');expect(api.createDocumentType).not.toHaveBeenCalled();
    c.typeForm.setValue({name:'  Offer   letter ',required:'yes'});c.saveType();
    expect(api.createDocumentType).toHaveBeenCalledWith({name:'Offer letter',required:true},jasmine.any(String));expect(c.types.length).toBe(2);
    expect(api.uploadCaseDocument).not.toHaveBeenCalled();
  });
  it('edits name/required and Delete sends archive rather than deleting documents',()=>{
    const f=setup(),c=f.componentInstance;c.open('types');f.detectChanges();c.edit(type);c.typeForm.setValue({name:'Passport copy',required:'no'});c.saveType();
    expect(api.updateDocumentType).toHaveBeenCalledWith('type-1',{name:'Passport copy',required:false,recordVersion:1},jasmine.any(String));
    c.archive(c.types[0]);expect(api.updateDocumentType.calls.mostRecent().args[1]).toEqual({status:'archived',recordVersion:2});expect(c.types).toEqual([]);
    expect(api.uploadCaseDocument).not.toHaveBeenCalled();
  });
  it('requires a typed file and delegates storage to the server with the same key on retry',()=>{
    const f=setup(),c=f.componentInstance;c.open('upload');f.detectChanges();
    c.upload();expect(api.uploadCaseDocument).not.toHaveBeenCalled();
    c.uploadForm.controls.documentTypeId.setValue('type-1');
    c.file=new File(['%PDF-1.7\n%%EOF'],'passport.pdf',{type:'application/pdf'});
    expect(f.nativeElement.querySelector('[formControlName="contact"]')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Xero Contact');
    api.uploadCaseDocument.and.returnValue(throwError(()=>({status:502})));c.upload();const key=api.uploadCaseDocument.calls.mostRecent().args[3];
    expect(c.message).toContain('retry this same file');
    api.uploadCaseDocument.and.returnValue(of({documentId:'document-1'}));c.upload();
    expect(api.uploadCaseDocument.calls.mostRecent().args).toEqual(['case-1',jasmine.any(File),'type-1',key]);
    expect(c.message).toBe('Document uploaded.');expect(c.file).toBeNull();
  });
  it('does not upload to an unlinked or disabled integration or accept active content',()=>{
    const f=setup(),c=f.componentInstance;c.open('upload');f.detectChanges();
    c.uploadForm.controls.documentTypeId.setValue('type-1');c.file=new File(['<svg/>'],'test.svg');c.upload();expect(api.uploadCaseDocument).not.toHaveBeenCalled();
    c.file=new File(['pdf'],'test.pdf');c.storageAvailable=false;c.upload();expect(api.uploadCaseDocument).not.toHaveBeenCalled();
    c.storageAvailable=true;c.uploadEnabled=false;c.upload();expect(api.uploadCaseDocument).not.toHaveBeenCalled();
  });
  it('blocks duplicate submissions and closing while an upload is in flight',()=>{
    const f=setup(),c=f.componentInstance;c.open('upload');f.detectChanges();c.uploadForm.controls.documentTypeId.setValue('type-1');c.file=new File(['pdf'],'test.pdf');
    const pending=new Subject<{documentId:string}>();api.uploadCaseDocument.and.returnValue(pending);c.upload();c.upload();const event=new Event('cancel',{cancelable:true});c.close(event);
    expect(api.uploadCaseDocument).toHaveBeenCalledTimes(1);expect(event.defaultPrevented).toBeTrue();expect(c.modal.nativeElement.open).toBeTrue();
    pending.next({documentId:'d'});expect(c.busy).toBeFalse();
  });
  it('keeps the selected file and shows an actionable capacity message without technical Contact controls',()=>{
    const f=setup(),c=f.componentInstance;c.open('upload');f.detectChanges();
    c.uploadForm.controls.documentTypeId.setValue('type-1');c.file=new File(['pdf'],'test.pdf');
    api.uploadCaseDocument.and.returnValue(throwError(()=>({status:409,error:{errorCode:'student_document_storage_full'}})));
    c.upload();expect(c.message).toBe('Document storage is full. Contact your administrator before uploading more files.');
    expect(c.file?.name).toBe('test.pdf');expect(c.busy).toBeFalse();
  });
  it('preserves the file and request identity while overflow storage is prepared automatically',()=>{
    const f=setup(),c=f.componentInstance;c.open('upload');f.detectChanges();
    c.uploadForm.controls.documentTypeId.setValue('type-1');c.file=new File(['pdf'],'test.pdf');
    api.uploadCaseDocument.and.returnValue(throwError(()=>({status:409,error:{errorCode:'student_document_storage_pending'}})));
    c.upload();const key=api.uploadCaseDocument.calls.mostRecent().args[3];
    expect(c.message).toContain('storage is being prepared');expect(c.message).not.toContain('Contact');
    expect(c.file?.name).toBe('test.pdf');c.upload();expect(api.uploadCaseDocument.calls.mostRecent().args[3]).toBe(key);
  });
  it('keeps the server error safe and allows a failed options request to be retried',()=>{
    const f=setup(),c=f.componentInstance;api.documentTypes.and.returnValue(throwError(()=>({error:'private database details'})));c.open('types');f.detectChanges();
    expect(c.failed).toBeTrue();expect(c.message).not.toContain('private');c.saveType();expect(api.createDocumentType).not.toHaveBeenCalled();
    api.documentTypes.and.returnValue(of({types:[type]}));c.loadTypes();expect(c.failed).toBeFalse();expect(c.types).toEqual([type]);
  });
  it('uses the register footer with a range, shared page jump and working first/previous/next/last controls',()=>{
    const f=setup(),c=f.componentInstance;c.open('types');
    c.types=Array.from({length:61},(_,i)=>({...type,documentTypeId:`type-${i}`,name:`Type ${String(i+1).padStart(2,'0')}`}));f.detectChanges();
    const root=f.nativeElement as HTMLElement;
    const button=(label:string)=>root.querySelector<HTMLButtonElement>(`.types-pagination [aria-label="${label}"]`)!;
    expect(root.querySelector('.types-pagination > span')?.textContent).toContain('Showing 1–25 of 61');
    expect(root.querySelectorAll('tbody tr').length).toBe(25);
    expect(button('First page').disabled).toBeTrue();expect(button('Previous page').disabled).toBeTrue();
    button('Next page').click();f.detectChanges();expect(c.page).toBe(2);
    expect(root.querySelector('.types-pagination > span')?.textContent).toContain('Showing 26–50 of 61');
    const input=root.querySelector<HTMLInputElement>('app-page-jump input')!;
    input.value='3';input.dispatchEvent(new Event('input'));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));f.detectChanges();
    expect(c.page).toBe(3);expect(root.querySelector('.types-pagination > span')?.textContent).toContain('Showing 51–61 of 61');
    expect(button('Next page').disabled).toBeTrue();expect(button('Last page').disabled).toBeTrue();
    button('Previous page').click();f.detectChanges();expect(c.page).toBe(2);
    button('First page').click();f.detectChanges();expect(c.page).toBe(1);
    button('Last page').click();f.detectChanges();expect(c.page).toBe(3);
    c.setSize('50');f.detectChanges();expect(c.page).toBe(1);expect(c.visibleTypes.length).toBe(50);
    expect(root.querySelector('.types-pagination > span')?.textContent).toContain('Showing 1–50 of 61');
    c.changePage(2);c.setSize('100');f.detectChanges();expect(c.pages).toBe(1);expect(c.visibleTypes.length).toBe(61);
    expect(api.documentTypes).toHaveBeenCalledTimes(1);
  });
  it('hides pagination for an empty directory and clamps it when the final row of a page is archived',()=>{
    const f=setup(),c=f.componentInstance;c.open('types');c.types=[];f.detectChanges();
    expect(f.nativeElement.querySelector('.types-pagination')).toBeNull();
    c.types=Array.from({length:26},(_,i)=>({...type,documentTypeId:`type-${i}`,name:`Type ${i}`}));c.changePage(2);f.detectChanges();
    c.archive(c.visibleTypes[0]);f.detectChanges();expect(c.page).toBe(1);expect(c.pages).toBe(1);
    expect(f.nativeElement.querySelector('.types-pagination > span').textContent).toContain('Showing 1–25 of 25');
  });
  it('guards page changes while saving and rejects invalid page/size values',()=>{
    const f=setup(),c=f.componentInstance;c.open('types');c.types=Array.from({length:60},(_,i)=>({...type,documentTypeId:`type-${i}`}));
    c.busy=true;c.changePage(2);c.setSize('50');expect(c.page).toBe(1);expect(c.pageSize).toBe(25);
    c.busy=false;c.changePage(Number.NaN);expect(c.page).toBe(1);c.changePage(99);expect(c.page).toBe(3);
    c.setSize('-1');expect(c.pageSize).toBe(25);expect(c.page).toBe(1);
  });
  for(const width of [390,1440]) for(const dark of [false,true]) it(`fits both modals at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    const f=setup(),c=f.componentInstance;
    for(const mode of ['types','upload'] as const){
      c.open(mode);if(mode==='types')c.types=Array.from({length:61},(_,i)=>({...type,documentTypeId:`type-${i}`,name:`Type ${i}`}));f.detectChanges();
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
      try {
        const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
        const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const modal=host.querySelector('dialog')!;modal.removeAttribute('open');modal.showModal();
        expect(modal.scrollWidth).toBeLessThanOrEqual(modal.clientWidth+1);expect(modal.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        expect(win.getComputedStyle(modal).backgroundColor).toBe(dark?'rgb(30, 41, 59)':'rgb(255, 255, 255)');
        if(mode==='types'){
          const footer=modal.querySelector('.types-pagination') as HTMLElement;
          const buttons=footer.querySelector('.page-buttons') as HTMLElement;
          expect(buttons.contains(footer.querySelector('.page-size'))).toBeTrue();expect(buttons.querySelector('app-page-jump')).not.toBeNull();
          expect(footer.scrollWidth).toBeLessThanOrEqual(footer.clientWidth+1);
          const first=buttons.querySelector(':scope > button')!;
          expect(win.getComputedStyle(first).backgroundColor).toBe(dark?'rgb(25, 36, 51)':'rgb(255, 255, 255)');
          if(width===1440)expect(Math.abs(footer.querySelector('.page-size')!.getBoundingClientRect().top-first.getBoundingClientRect().top)).toBeLessThan(6);
        }
        for(const b of modal.querySelectorAll<HTMLButtonElement>('.btn')) if(b.getBoundingClientRect().height)expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      } finally {frame.remove();c.close();}
    }f.destroy();
  });
});
