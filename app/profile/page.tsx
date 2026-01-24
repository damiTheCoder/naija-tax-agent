"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { useTheme } from "@/lib/ThemeContext";

export default function ProfilePage() {
    const { profile, updateProfile, workspaces, currentWorkspace, createWorkspace, deleteWorkspace, renameWorkspace, switchWorkspace } = useWorkspace();
    const { theme } = useTheme();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(profile.name);
    const [editEmail, setEditEmail] = useState(profile.email);

    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
    const [editingWorkspaceName, setEditingWorkspaceName] = useState("");

    const handleSaveProfile = () => {
        updateProfile({ name: editName, email: editEmail });
        setIsEditing(false);
    };

    const handleCreateWorkspace = () => {
        if (newWorkspaceName.trim()) {
            const workspace = createWorkspace(newWorkspaceName.trim());
            setNewWorkspaceName("");
            setIsCreating(false);
            // Optionally switch to new workspace
            switchWorkspace(workspace.id);
        }
    };

    const handleRenameWorkspace = (id: string) => {
        if (editingWorkspaceName.trim()) {
            renameWorkspace(id, editingWorkspaceName.trim());
            setEditingWorkspaceId(null);
            setEditingWorkspaceName("");
        }
    };

    const isDark = theme === "dark";

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Page Header */}
            <div>
                <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Profile & Workspaces
                </h1>
                <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Manage your profile and workspace settings
                </p>
            </div>

            {/* Profile Section */}
            <div className={`rounded-2xl border p-6 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                            {profile.name.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                {profile.name || "User"}
                            </h2>
                            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                {profile.email || "No email set"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (isEditing) {
                                handleSaveProfile();
                            } else {
                                setEditName(profile.name);
                                setEditEmail(profile.email);
                                setIsEditing(true);
                            }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isEditing
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : isDark
                                    ? "bg-white/10 text-white hover:bg-white/20"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        {isEditing ? "Save" : "Edit"}
                    </button>
                </div>

                {isEditing && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div>
                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                Name
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                        : "bg-white border-gray-200 text-gray-900"
                                    }`}
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                Email
                            </label>
                            <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                        : "bg-white border-gray-200 text-gray-900"
                                    }`}
                                placeholder="your@email.com"
                            />
                        </div>
                        <button
                            onClick={() => setIsEditing(false)}
                            className={`text-sm ${isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Workspaces Section */}
            <div className={`rounded-2xl border p-6 ${isDark ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"}`}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Workspaces
                        </h2>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            Each workspace has its own data and settings
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        New Workspace
                    </button>
                </div>

                {/* Create Workspace Form */}
                {isCreating && (
                    <div className={`mb-4 p-4 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                            Workspace Name
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                        ? "bg-gray-900 border-gray-600 text-white placeholder-gray-500"
                                        : "bg-white border-gray-200 text-gray-900"
                                    }`}
                                placeholder="e.g., My Business, Side Project"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateWorkspace();
                                    if (e.key === "Escape") setIsCreating(false);
                                }}
                            />
                            <button
                                onClick={handleCreateWorkspace}
                                disabled={!newWorkspaceName.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewWorkspaceName("");
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Workspace List */}
                <div className="space-y-2">
                    {workspaces.map((workspace) => (
                        <div
                            key={workspace.id}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${workspace.id === currentWorkspace?.id
                                    ? isDark
                                        ? "bg-blue-900/20 border-blue-800"
                                        : "bg-blue-50 border-blue-200"
                                    : isDark
                                        ? "bg-gray-800/50 border-gray-700 hover:bg-gray-800"
                                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                }`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold ${workspace.id === currentWorkspace?.id
                                        ? "bg-gradient-to-br from-blue-500 to-purple-600"
                                        : "bg-gray-600"
                                    }`}>
                                    {workspace.name.charAt(0).toUpperCase()}
                                </div>

                                {editingWorkspaceId === workspace.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={editingWorkspaceName}
                                            onChange={(e) => setEditingWorkspaceName(e.target.value)}
                                            className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${isDark
                                                    ? "bg-gray-900 border-gray-600 text-white"
                                                    : "bg-white border-gray-200 text-gray-900"
                                                }`}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRenameWorkspace(workspace.id);
                                                if (e.key === "Escape") {
                                                    setEditingWorkspaceId(null);
                                                    setEditingWorkspaceName("");
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => handleRenameWorkspace(workspace.id)}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium"
                                        >
                                            Save
                                        </button>
                                    </div>
                                ) : (
                                    <div className="min-w-0">
                                        <p className={`font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                                            {workspace.name}
                                        </p>
                                        <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                            Created {new Date(workspace.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                {workspace.id === currentWorkspace?.id ? (
                                    <span className="px-2.5 py-1 bg-green-500/20 text-green-500 rounded-full text-xs font-medium">
                                        Active
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => switchWorkspace(workspace.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark
                                                ? "bg-white/10 text-white hover:bg-white/20"
                                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            }`}
                                    >
                                        Switch
                                    </button>
                                )}

                                {/* Actions Dropdown */}
                                <div className="relative group">
                                    <button className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"
                                        }`}>
                                        <svg className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className={`absolute right-0 top-full mt-1 w-36 rounded-lg border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                                        }`}>
                                        <button
                                            onClick={() => {
                                                setEditingWorkspaceId(workspace.id);
                                                setEditingWorkspaceName(workspace.name);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                            </svg>
                                            Rename
                                        </button>
                                        {workspaces.length > 1 && workspace.id !== currentWorkspace?.id && (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete "${workspace.name}"? This cannot be undone.`)) {
                                                        deleteWorkspace(workspace.id);
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Note */}
                <div className={`mt-6 flex items-start gap-3 p-4 rounded-xl ${isDark ? "bg-blue-900/20" : "bg-blue-50"}`}>
                    <svg className={`w-5 h-5 mt-0.5 ${isDark ? "text-blue-400" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <div>
                        <p className={`text-sm font-medium ${isDark ? "text-blue-300" : "text-blue-900"}`}>
                            Data Isolation
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-blue-400/70" : "text-blue-700/70"}`}>
                            Each workspace has completely separate transactions, bank connections, invoices, and tax records.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
