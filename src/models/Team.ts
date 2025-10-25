import { AuditableEntity } from '../types';
import { validateUUID } from '../utils/validation';

export interface Team extends AuditableEntity {
  clientId: string;
  rbtIds: string[];
  primaryRbtId: string;
  effectiveDate: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface CreateTeamRequest {
  clientId: string;
  rbtIds: string[];
  primaryRbtId: string;
  effectiveDate: Date;
  createdBy: string;
}

export interface UpdateTeamRequest {
  rbtIds?: string[];
  primaryRbtId?: string;
  endDate?: Date;
  isActive?: boolean;
  updatedBy: string;
}

export interface TeamAssignment {
  teamId: string;
  rbtId: string;
  assignedDate: Date;
  removedDate?: Date;
  isPrimary: boolean;
  qualificationMatch: boolean;
}

export interface TeamHistory {
  teamId: string;
  clientId: string;
  changes: TeamChange[];
}

export interface TeamChange {
  changeDate: Date;
  changeType: 'rbt_added' | 'rbt_removed' | 'primary_changed' | 'team_created' | 'team_ended';
  rbtId?: string;
  previousPrimaryRbtId?: string;
  newPrimaryRbtId?: string;
  changedBy: string;
  reason?: string;
}

// Validation functions
export const validateTeamChangeType = (changeType: string): changeType is TeamChange['changeType'] => {
  return ['rbt_added', 'rbt_removed', 'primary_changed', 'team_created', 'team_ended'].includes(changeType);
};

export const validateTeam = (team: Partial<Team>): string[] => {
  const errors: string[] = [];

  if (team.clientId !== undefined && !validateUUID(team.clientId)) {
    errors.push('Valid client ID is required');
  }

  if (team.rbtIds !== undefined) {
    if (!Array.isArray(team.rbtIds) || team.rbtIds.length === 0) {
      errors.push('At least one RBT ID is required');
    } else {
      for (const rbtId of team.rbtIds) {
        if (!validateUUID(rbtId)) {
          errors.push('All RBT IDs must be valid UUIDs');
          break;
        }
      }
    }
  }

  if (team.primaryRbtId !== undefined && !validateUUID(team.primaryRbtId)) {
    errors.push('Valid primary RBT ID is required');
  }

  // Validate that primary RBT is in the team
  if (team.rbtIds !== undefined && team.primaryRbtId !== undefined && !team.rbtIds.includes(team.primaryRbtId)) {
    errors.push('Primary RBT must be a member of the team');
  }

  if (team.effectiveDate !== undefined && team.effectiveDate > new Date()) {
    errors.push('Effective date cannot be in the future');
  }

  if (team.endDate !== undefined && team.effectiveDate !== undefined && team.endDate < team.effectiveDate) {
    errors.push('End date cannot be before effective date');
  }

  return errors;
};

export const validateCreateTeamRequest = (data: CreateTeamRequest): string[] => {
  const errors: string[] = [];

  if (!data.clientId || !validateUUID(data.clientId)) {
    errors.push('Valid client ID is required');
  }

  if (!Array.isArray(data.rbtIds) || data.rbtIds.length === 0) {
    errors.push('At least one RBT ID is required');
  } else {
    for (const rbtId of data.rbtIds) {
      if (!validateUUID(rbtId)) {
        errors.push('All RBT IDs must be valid UUIDs');
        break;
      }
    }
  }

  if (!data.primaryRbtId || !validateUUID(data.primaryRbtId)) {
    errors.push('Valid primary RBT ID is required');
  }

  // Validate that primary RBT is in the team
  if (data.rbtIds && data.primaryRbtId && !data.rbtIds.includes(data.primaryRbtId)) {
    errors.push('Primary RBT must be a member of the team');
  }

  if (!data.effectiveDate) {
    errors.push('Effective date is required');
  } else if (data.effectiveDate > new Date()) {
    errors.push('Effective date cannot be in the future');
  }

  if (!data.createdBy || !validateUUID(data.createdBy)) {
    errors.push('Valid creator ID is required');
  }

  return errors;
};

export const validateUpdateTeamRequest = (data: UpdateTeamRequest): string[] => {
  const errors: string[] = [];

  if (data.rbtIds !== undefined) {
    if (!Array.isArray(data.rbtIds) || data.rbtIds.length === 0) {
      errors.push('At least one RBT ID is required');
    } else {
      for (const rbtId of data.rbtIds) {
        if (!validateUUID(rbtId)) {
          errors.push('All RBT IDs must be valid UUIDs');
          break;
        }
      }
    }
  }

  if (data.primaryRbtId !== undefined && !validateUUID(data.primaryRbtId)) {
    errors.push('Valid primary RBT ID is required');
  }

  // Validate that primary RBT is in the team (if both are provided)
  if (data.rbtIds !== undefined && data.primaryRbtId !== undefined && !data.rbtIds.includes(data.primaryRbtId)) {
    errors.push('Primary RBT must be a member of the team');
  }

  if (!data.updatedBy || !validateUUID(data.updatedBy)) {
    errors.push('Valid updater ID is required');
  }

  return errors;
};

export const validateTeamChange = (change: TeamChange): string[] => {
  const errors: string[] = [];

  if (!validateTeamChangeType(change.changeType)) {
    errors.push('Valid change type is required');
  }

  if (change.rbtId !== undefined && !validateUUID(change.rbtId)) {
    errors.push('Valid RBT ID is required');
  }

  if (change.previousPrimaryRbtId !== undefined && !validateUUID(change.previousPrimaryRbtId)) {
    errors.push('Valid previous primary RBT ID is required');
  }

  if (change.newPrimaryRbtId !== undefined && !validateUUID(change.newPrimaryRbtId)) {
    errors.push('Valid new primary RBT ID is required');
  }

  if (!change.changedBy || !validateUUID(change.changedBy)) {
    errors.push('Valid changer ID is required');
  }

  return errors;
};