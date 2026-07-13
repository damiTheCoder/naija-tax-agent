"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
    Workspace,
    UserProfile,
    WorkspaceContextValue,
    DEFAULT_WORKSPACE,
    DEFAULT_PROFILE,
    STORAGE_KEYS,
} from "./workspace/types";

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// Generate unique ID
function generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const storedWorkspaces = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
        const storedCurrentId = localStorage.getItem(STORAGE_KEYS.CURRENT_WORKSPACE_ID);
        const storedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);

        let parsedWorkspaces: Workspace[] = [];
        if (storedWorkspaces) {
            try {
                parsedWorkspaces = JSON.parse(storedWorkspaces);
            } catch (e) {
                console.error("Failed to parse workspaces", e);
            }
        }

        // If no workspaces, create default one
        if (parsedWorkspaces.length === 0) {
            parsedWorkspaces = [{ ...DEFAULT_WORKSPACE, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
            localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(parsedWorkspaces));
        }

        const frameId = window.requestAnimationFrame(() => {
            setWorkspaces(parsedWorkspaces);

            // Set current workspace
            if (storedCurrentId && parsedWorkspaces.find(w => w.id === storedCurrentId)) {
                setCurrentWorkspaceId(storedCurrentId);
            } else {
                setCurrentWorkspaceId(parsedWorkspaces[0].id);
                localStorage.setItem(STORAGE_KEYS.CURRENT_WORKSPACE_ID, parsedWorkspaces[0].id);
            }

            // Load profile
            if (storedProfile) {
                try {
                    setProfile(JSON.parse(storedProfile));
                } catch (e) {
                    console.error("Failed to parse profile", e);
                }
            }

            setIsLoaded(true);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    // Get current workspace
    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;

    // Get storage key with workspace prefix
    const getStorageKey = useCallback((baseKey: string): string => {
        if (!currentWorkspaceId) return baseKey;
        return `ws_${currentWorkspaceId}_${baseKey}`;
    }, [currentWorkspaceId]);

    // Switch workspace
    const switchWorkspace = useCallback((id: string) => {
        const workspace = workspaces.find(w => w.id === id);
        if (workspace) {
            setCurrentWorkspaceId(id);
            localStorage.setItem(STORAGE_KEYS.CURRENT_WORKSPACE_ID, id);
            // Reload page to reinitialize all data with new workspace
            window.location.reload();
        }
    }, [workspaces]);

    // Create workspace
    const createWorkspace = useCallback((name: string): Workspace => {
        const newWorkspace: Workspace = {
            id: generateId(),
            name: name.trim() || "New Workspace",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const updatedWorkspaces = [...workspaces, newWorkspace];
        setWorkspaces(updatedWorkspaces);
        localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(updatedWorkspaces));

        return newWorkspace;
    }, [workspaces]);

    // Delete workspace
    const deleteWorkspace = useCallback((id: string) => {
        // Can't delete the last workspace
        if (workspaces.length <= 1) return;

        // Can't delete current workspace
        if (id === currentWorkspaceId) return;

        const updatedWorkspaces = workspaces.filter(w => w.id !== id);
        setWorkspaces(updatedWorkspaces);
        localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(updatedWorkspaces));

        // Clean up workspace data from localStorage
        const prefix = `ws_${id}_`;
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        });
    }, [workspaces, currentWorkspaceId]);

    // Rename workspace
    const renameWorkspace = useCallback((id: string, newName: string) => {
        const updatedWorkspaces = workspaces.map(w =>
            w.id === id
                ? { ...w, name: newName.trim() || w.name, updatedAt: new Date().toISOString() }
                : w
        );
        setWorkspaces(updatedWorkspaces);
        localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(updatedWorkspaces));
    }, [workspaces]);

    // Update profile
    const updateProfile = useCallback((updates: Partial<UserProfile>) => {
        setProfile((currentProfile) => {
            const updatedProfile = { ...currentProfile, ...updates };
            localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
            return updatedProfile;
        });
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                currentWorkspace,
                workspaces,
                profile,
                switchWorkspace,
                createWorkspace,
                deleteWorkspace,
                renameWorkspace,
                updateProfile,
                getStorageKey,
                isLoaded,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error("useWorkspace must be used within a WorkspaceProvider");
    }
    return context;
}
