import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { StudentGuidanceView } from './student-guidance';

@Component({
  selector:'app-student-guidance-panel',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./student-guidance-panel.component.html',
  styleUrls:['./student-guidance-panel.component.css'],
})
export class StudentGuidancePanelComponent {
  @Input({required:true}) view!: StudentGuidanceView;
  @Output() closeView = new EventEmitter<void>();
  evidenceLabel(status:string):string {
    return ({live:'Official page checked live',reviewed:'Previously reviewed information',cached:'Saved source — live check unavailable',unavailable:'Verification unavailable'} as Record<string,string>)[status] || 'Verification unavailable';
  }
  changeLabel(status:string):string {
    return ({announced:'Announced — not yet in force',in_force:'In force as described by the source',superseded:'Historical rule',general:'General information'} as Record<string,string>)[status]||'Status not established';
  }
}
