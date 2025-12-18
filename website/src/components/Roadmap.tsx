import React from 'react';

const steps = [
    {
        name: 'Phase 1: Juvenile (MVP)',
        status: 'current',
        description: 'Core macOS control loop using Accessibility APIs. Basic app management, window control, and voice command capture.',
    },
    {
        name: 'Phase 2: Reliability & Eyes',
        status: 'upcoming',
        description: 'Integrating Eye Tracking for cursor control. Improving latency and reliability. Migrating to Tauri for performance.',
    },
    {
        name: 'Phase 3: Cross-Platform',
        status: 'future',
        description: 'Expanding to Windows and Linux. Full security audit by Jarwis AI. Mobile companion apps.',
    },
];

export default function Roadmap() {
    return (
        <div className="bg-gray-950 py-24 sm:py-32" id="roadmap">
            <div className="mx-auto max-w-7xl px-4 lg:px-8">
                <div className="mx-auto max-w-2xl lg:text-center mb-16">
                    <h2 className="text-base font-semibold leading-7 text-blue-400">Roadmap</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Building the Future
                    </p>
                </div>

                <div className="relative border-l border-gray-800 ml-4 md:ml-0 md:mx-auto md:max-w-2xl space-y-12">
                    {steps.map((step, stepIdx) => (
                        <div key={step.name} className="relative pl-8 md:pl-12">
                            {/* Dot */}
                            <div
                                className={`absolute -left-1.5 top-2 h-3 w-3 rounded-full border-2 border-gray-950 ${step.status === 'current' ? 'bg-blue-500 ring-4 ring-blue-500/20' :
                                        step.status === 'upcoming' ? 'bg-gray-600' : 'bg-gray-800'
                                    }`}
                            ></div>

                            <h3 className={`text-xl font-semibold leading-7 ${step.status === 'current' ? 'text-white' : 'text-gray-400'}`}>
                                {step.name}
                                {step.status === 'current' && (
                                    <span className="ml-3 inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20">
                                        Current
                                    </span>
                                )}
                            </h3>
                            <p className="mt-2 text-base leading-7 text-gray-500">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
