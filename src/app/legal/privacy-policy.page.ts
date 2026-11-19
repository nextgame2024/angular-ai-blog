import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-privacy-policy',
  imports: [RouterLink],
  templateUrl: './privacy-policy.page.html',
  styleUrl: './legal.page.css',
})
export class PrivacyPolicyPage {}
