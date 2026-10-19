import { TestBed } from '@angular/core/testing';
import { ManagerSelectComponent } from './manager-select.component';

describe('ManagerSelectComponent pagination menu', () => {
  it('opens upward above the trigger and remains usable in narrow/light/dark layouts', () => {
    const fixture = TestBed.createComponent(ManagerSelectComponent);
    fixture.componentRef.setInput('panelDirection', 'up');
    fixture.componentRef.setInput('options', [{ value: '25', label: '25 per page' }, { value: '50', label: '50 per page' }]);
    fixture.componentInstance.writeValue('25');
    fixture.nativeElement.style.cssText = 'position:fixed;bottom:10px;left:10px;width:150px';
    fixture.detectChanges();
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      (fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
      const menu = fixture.nativeElement.querySelector('.select-menu') as HTMLElement;
      const trigger = fixture.nativeElement.querySelector('.select-trigger') as HTMLElement;
      expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top);
      expect(getComputedStyle(menu).position).toBe('fixed');
      (fixture.nativeElement.querySelectorAll('.select-option')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('50');
    }
    document.documentElement.classList.remove('dark');
  });
});
