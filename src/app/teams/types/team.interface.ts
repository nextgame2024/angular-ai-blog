/**
 * TeamInterface
 * -------------
 * Shared shape of a Team object returned by the API.
 * Helpful for strong typing in services, effects, and components.
 */

export interface TeamInterface {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
