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
    const [editPhone, setEditPhone] = useState(profile.phone || "");
    const [editCompany, setEditCompany] = useState(profile.company || "");

    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
    const [editingWorkspaceName, setEditingWorkspaceName] = useState("");

    const handleSaveProfile = () => {
        updateProfile({
            name: editName,
            email: editEmail,
            phone: editPhone,
            company: editCompany
        });
        setIsEditing(false);
    };

    const handleCreateWorkspace = () => {
        if (newWorkspaceName.trim()) {
            const workspace = createWorkspace(newWorkspaceName.trim());
            setNewWorkspaceName("");
            setIsCreating(false);
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

    // Get initials for avatar
    const initials = profile.name
        ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : "U";

    return (
        <div className="space-y-6 pb-32">
            <section className="relative min-h-[75vh]">
                <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-36 space-y-3 md:space-y-5">
                    <div className="space-y-4">

                        {/* Profile Header */}
                        <div>
                            <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Profile</p>
                            <p className="text-2xl font-bold" style={{ color: '#2264ff' }}>
                                {profile.name || "Your Name"}
                            </p>
                        </div>

                        {/* Profile Card */}
                        <div className={`rounded-2xl border p-5 ${isDark ? 'border-gray-600 bg-[#0a0a0a]' : 'border-gray-300 bg-white'}`}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                        {initials}
                                    </div>
                                    <div>
                                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                            {profile.name || "User"}
                                        </h2>
                                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                            {profile.email || "No email set"}
                                        </p>
                                        {profile.company && (
                                            <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                                {profile.company}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isEditing) {
                                            handleSaveProfile();
                                        } else {
                                            setEditName(profile.name);
                                            setEditEmail(profile.email);
                                            setEditPhone(profile.phone || "");
                                            setEditCompany(profile.company || "");
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
                                <div className={`space-y-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        <div>
                                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                                Phone
                                            </label>
                                            <input
                                                type="tel"
                                                value={editPhone}
                                                onChange={(e) => setEditPhone(e.target.value)}
                                                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                                    : "bg-white border-gray-200 text-gray-900"
                                                    }`}
                                                placeholder="+234 800 000 0000"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                                Company
                                            </label>
                                            <input
                                                type="text"
                                                value={editCompany}
                                                onChange={(e) => setEditCompany(e.target.value)}
                                                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                                    : "bg-white border-gray-200 text-gray-900"
                                                    }`}
                                                placeholder="Your Company Ltd"
                                            />
                                        </div>
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

                        {/* Workspaces Section Header */}
                        <div className="pt-4">
                            <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Workspaces</p>
                            <div className="flex items-center justify-between">
                                <p className="text-2xl font-bold" style={{ color: '#2264ff' }}>
                                    {workspaces.length}
                                    <span className={`text-sm font-normal ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>workspace{workspaces.length !== 1 ? 's' : ''}</span>
                                </p>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    New
                                </button>
                            </div>
                        </div>

                        {/* Create Workspace Form */}
                        {isCreating && (
                            <div className={`rounded-2xl border p-4 ${isDark ? "bg-[#0a0a0a] border-gray-600" : "bg-white border-gray-300"}`}>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                    Workspace Name
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newWorkspaceName}
                                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                                        className={`flex-1 px-4 py-2.5 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                            ? "bg-gray-800 border-gray-600 text-white placeholder-gray-500"
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
                                    className={`rounded-2xl border p-4 transition-all ${workspace.id === currentWorkspace?.id
                                        ? isDark
                                            ? "bg-blue-900/20 border-blue-700"
                                            : "bg-blue-50 border-blue-200"
                                        : isDark
                                            ? "bg-[#0a0a0a] border-gray-600 hover:bg-[#1a1a1a] hover:border-gray-500"
                                            : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
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

                                            {/* Actions */}
                                            <button
                                                onClick={() => {
                                                    setEditingWorkspaceId(workspace.id);
                                                    setEditingWorkspaceName(workspace.name);
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-200 text-gray-500"}`}
                                                title="Rename"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                                </svg>
                                            </button>
                                            {workspaces.length > 1 && workspace.id !== currentWorkspace?.id && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete "${workspace.name}"? This cannot be undone.`)) {
                                                            deleteWorkspace(workspace.id);
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Info Note */}
                        <div className={`flex items-start gap-3 p-4 rounded-2xl ${isDark ? "bg-blue-900/20" : "bg-blue-50"}`}>
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
            </section>
        </div>
    );
}
