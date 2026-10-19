import { TestBed } from '@angular/core/testing';
import { PageJumpComponent } from './page-jump.component';

describe('PageJumpComponent', () => {
  it('jumps directly, clamps to the last page, rejects invalid values and respects loading', () => {
    const fixture = TestBed.createComponent(PageJumpComponent);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 43);
    fixture.detectChanges();
    const change = spyOn(fixture.componentInstance.pageChange, 'emit');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '20'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(change).toHaveBeenCalledOnceWith(20);
    fixture.componentInstance.draft = '100'; fixture.componentInstance.go();
    expect(change).toHaveBeenCalledWith(43);
    change.calls.reset();
    for (const value of ['', '0', '-2', '2.5', 'NaN']) {
      fixture.componentInstance.draft = value; fixture.componentInstance.go();
      expect(change).not.toHaveBeenCalled();
    }
    fixture.componentRef.setInput('disabled', true);
    fixture.componentInstance.draft = '20'; fixture.componentInstance.go();
    expect(change).not.toHaveBeenCalled();
  });
});
