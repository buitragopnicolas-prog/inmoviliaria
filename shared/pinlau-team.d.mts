export type TeamMember = {name: string; role: string; photo: string};
export const maxTeamSize: number;
export function validMemberInfo(name: unknown, role: unknown): boolean;
export function isTeamPhoto(path: unknown): boolean;
export function readTeam(value: unknown): TeamMember[] | null;
