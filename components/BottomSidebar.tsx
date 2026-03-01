"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/WorkspaceContext";

interface BottomSidebarProps {
    variant?: "floating" | "sidebar";
}

export default function BottomSidebar({ variant = "floating" }: BottomSidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const { currentWorkspace, workspaces, switchWorkspace, isLoaded } = useWorkspace();
    const isSidebarVariant = variant === "sidebar";

    // Close panel when clicking outside (but not on the button)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Ignore clicks on the toggle button
            if (buttonRef.current && buttonRef.current.contains(target)) {
                return;
            }
            // Close if clicking outside the panel
            if (panelRef.current && !panelRef.current.contains(target)) {
                setIsOpen(false);
                setShowWorkspaceSwitcher(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Close panel when navigating
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setIsOpen(false);
            setShowWorkspaceSwitcher(false);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [pathname]);

    // Don't render until workspace is loaded
    if (!isLoaded) return null;

    // Don't show on landing page
    if (pathname === "/") return null;

    const handleProfileClick = () => {
        setIsOpen(false);
        router.push("/profile");
    };

    // Get gradient colors based on workspace index
    const getWorkspaceGradient = (workspaceId: string): string => {
        const index = workspaces.findIndex(w => w.id === workspaceId);
        const gradients = [
            "from-blue-400 to-blue-600",
            "from-indigo-400 to-blue-500",
            "from-cyan-400 to-blue-600",
        ];
        return gradients[index % gradients.length] || gradients[0];
    };

    const currentGradient = currentWorkspace ? getWorkspaceGradient(currentWorkspace.id) : "from-blue-400 to-blue-600";

    return (
        <div className={isSidebarVariant ? "relative" : ""}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`
          ${isSidebarVariant
                        ? "relative w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#05070b] hover:bg-[#0d121b] px-3 py-2.5 text-white"
                        : "fixed bottom-6 right-6 z-[60] hidden lg:flex gap-2 px-3 py-2 rounded-full bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white shadow-lg items-center justify-center"
                    }
          transition-all duration-300 ease-out cursor-pointer
        `}
                aria-label={isOpen ? "Close workspace menu" : "Open workspace menu"}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {/* Workspace Avatar */}
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${currentGradient} flex items-center justify-center text-[11px] font-medium text-white shadow-sm`}>
                        {currentWorkspace?.name.charAt(0).toUpperCase() || "W"}
                    </div>
                    {/* Workspace Name */}
                    <span className={`font-medium truncate ${isSidebarVariant ? "text-sm" : "text-xs max-w-[100px]"}`}>
                        {currentWorkspace?.name || "Workspace"}
                    </span>
                </div>
                <svg
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${isSidebarVariant ? "text-white/60" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 15l7-7 7 7"
                    />
                </svg>
            </button>

            {/* Overlay */}
            {isOpen && !isSidebarVariant && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] hidden lg:block"
                    onClick={() => {
                        setIsOpen(false);
                        setShowWorkspaceSwitcher(false);
                    }}
                />
            )}

            {/* Slide-up Panel */}
            <div
                ref={panelRef}
                className={`
          ${isSidebarVariant
                        ? "absolute left-0 right-0 bottom-[calc(100%+0.5rem)] z-30"
                        : "fixed right-6 z-[59] hidden lg:block"
                    }
          w-52 ${isSidebarVariant ? "w-full" : ""} bg-[#0a0a0a] rounded-xl
          shadow-2xl border border-white/10
          transition-all duration-300 ease-out
          ${isOpen
                        ? isSidebarVariant ? "opacity-100 translate-y-0" : "opacity-100 bottom-20"
                        : isSidebarVariant ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-0 bottom-6 pointer-events-none"
                    }
        `}
            >
                {/* Panel Header */}
                <div className="px-3 py-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${currentGradient} flex items-center justify-center text-white text-xs font-medium shadow-sm`}>
                            {currentWorkspace?.name.charAt(0).toUpperCase() || "W"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                                {currentWorkspace?.name || "Workspace"}
                            </p>
                            <p className="text-[10px] text-white/50">Active</p>
                        </div>
                    </div>
                </div>

                {/* Menu Items */}
                <nav className="p-1.5">
                    {/* Profile Link */}
                    <button
                        onClick={handleProfileClick}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors group/item"
                    >
                        <svg
                            className="w-4 h-4 text-blue-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                        </svg>
                        <span className="text-xs font-medium">Profile</span>
                        <svg
                            className="w-3 h-3 ml-auto text-white/40"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>

                    {/* Workspace Switcher */}
                    <button
                        onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                            />
                        </svg>
                        <span className="text-xs font-medium">Workspaces</span>
                        <svg
                            className={`w-3 h-3 ml-auto text-white/40 transition-transform ${showWorkspaceSwitcher ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>

                    {/* Workspace List */}
                    {showWorkspaceSwitcher && (
                        <div className="mt-1 ml-6 space-y-0.5 border-l border-white/10 pl-2">
                            {workspaces.map((workspace) => (
                                <button
                                    key={workspace.id}
                                    onClick={() => {
                                        if (workspace.id !== currentWorkspace?.id) {
                                            switchWorkspace(workspace.id);
                                        }
                                    }}
                                    className={`
                                        w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors
                                        ${workspace.id === currentWorkspace?.id
                                            ? "bg-white/10 text-white"
                                            : "text-white/60 hover:text-white hover:bg-white/5"
                                        }
                                    `}
                                >
                                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${getWorkspaceGradient(workspace.id)}`} />
                                    <span className="truncate flex-1 text-left">{workspace.name}</span>
                                    {workspace.id === currentWorkspace?.id && (
                                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}

                            {/* Manage in Profile */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/profile");
                                }}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>Manage</span>
                            </button>
                        </div>
                    )}
                </nav>
            </div>
        </div>
    );
}
