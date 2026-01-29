import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-manager-section-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-section.page.html',
  styleUrls: ['./manager-section.page.css'],
})
export class ManagerSectionPageComponent {
  title = this.route.snapshot.data['title'] || 'Section';

  constructor(private route: ActivatedRoute) {}
}
