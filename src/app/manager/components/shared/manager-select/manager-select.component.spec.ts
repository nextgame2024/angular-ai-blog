import { TestBed } from '@angular/core/testing';
import { ManagerSelectComponent } from './manager-select.component';

describe('ManagerSelectComponent pagination menu', () => {
  it('stays 6px above the selector inside an offset, filtered manager shell', () => {
    const fixture = TestBed.createComponent(ManagerSelectComponent);
    const shell = document.createElement('div');
    shell.style.cssText='position:fixed;top:110px;bottom:30px;left:12px;right:12px;backdrop-filter:blur(6px);transform:translateZ(0)';
    document.body.appendChild(shell);
    shell.appendChild(fixture.nativeElement);
    fixture.nativeElement.style.cssText='position:absolute;bottom:10px;left:20px;width:145px';
    fixture.componentRef.setInput('panelDirection','up');
    fixture.componentRef.setInput('options',[{value:'25',label:'25 per page'},{value:'100',label:'100 per page'}]);
    try {
      for(const width of ['350px','900px']) for(const dark of [false,true]) {
        shell.style.width=width;
        document.documentElement.classList.toggle('dark',dark);
        fixture.detectChanges();
        fixture.componentInstance.toggle();fixture.detectChanges();
        const menu=fixture.nativeElement.querySelector('.select-menu') as HTMLElement;
        const trigger=fixture.nativeElement.querySelector('.select-trigger') as HTMLElement;
        expect(trigger.getBoundingClientRect().top-menu.getBoundingClientRect().bottom).toBeCloseTo(6,0);
        expect(menu.getBoundingClientRect().left).toBeCloseTo(trigger.getBoundingClientRect().left,0);
        fixture.componentInstance.closeMenu();fixture.detectChanges();
      }
    } finally { fixture.destroy();shell.remove();document.documentElement.classList.remove('dark'); }
  });
  it('keeps 100 per page on one line beside its selection check', () => {
    const fixture = TestBed.createComponent(ManagerSelectComponent);
    fixture.nativeElement.classList.add('page-size');
    fixture.componentRef.setInput('panelDirection', 'up');
    fixture.componentRef.setInput('options', [{value:'100',label:'100 per page'}]);
    fixture.componentInstance.writeValue('100');
    fixture.nativeElement.style.cssText='position:fixed;bottom:10px;left:10px';
    for(const dark of [false,true]) {
      document.documentElement.classList.toggle('dark',dark);
      fixture.detectChanges();
      fixture.componentInstance.toggle();fixture.detectChanges();
      const option=fixture.nativeElement.querySelector('.select-option') as HTMLElement;
      const label=option.querySelector('span') as HTMLElement;
      const check=option.querySelector('.check') as HTMLElement;
      expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
      expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(check.getBoundingClientRect().left);
      expect(check.getBoundingClientRect().right).toBeLessThanOrEqual(option.getBoundingClientRect().right);
      fixture.componentInstance.closeMenu();
    }
    document.documentElement.classList.remove('dark');
  });
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
