// Workspace types for multi-workspace management in CashOS

export interface Workspace {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    avatar?: string;
}

export interface WorkspaceContextValue {
    // Current active workspace
    currentWorkspace: Workspace | null;

    // All workspaces
    workspaces: Workspace[];

    // User profile
    profile: UserProfile;

    // Actions
    switchWorkspace: (id: string) => void;
    createWorkspace: (name: string) => Workspace;
    deleteWorkspace: (id: string) => void;
    renameWorkspace: (id: string, newName: string) => void;
    updateProfile: (updates: Partial<UserProfile>) => void;

    // Helpers
    getStorageKey: (baseKey: string) => string;
    isLoaded: boolean;
}

// Default workspace created on first load
export const DEFAULT_WORKSPACE: Workspace = {
    id: 'default',
    name: 'My Business',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

// Default user profile
export const DEFAULT_PROFILE: UserProfile = {
    id: 'user-1',
    name: 'User',
    email: '',
};

// Storage keys
export const STORAGE_KEYS = {
    WORKSPACES: 'cashos_workspaces',
    CURRENT_WORKSPACE_ID: 'cashos_current_workspace_id',
    USER_PROFILE: 'cashos_user_profile',
} as const;
