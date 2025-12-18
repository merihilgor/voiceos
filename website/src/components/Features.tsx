import React from 'react';
import { Brain, Shield, Zap, Eye, MousePointer2, Layers } from 'lucide-react';

const features = [
    {
        name: 'Multimodal Intelligence',
        description: 'Powered by Google Gemini to understand complex, natural language commands and context.',
        icon: Brain,
    },
    {
        name: 'Native Control',
        description: 'Direct integration with macOS Accessibility APIs allows for deep system control without fragile scripts.',
        icon: Zap,
    },
    {
        name: 'Privacy Focused',
        description: 'Local PII masking ensures sensitive data like credit cards and passwords never leave your device.',
        icon: Shield,
    },
    {
        name: 'Eye Tracking (Phase 2)',
        description: 'Navigate your screen using just your eyes. A truly hands-free experience for accessibility.',
        icon: Eye,
    },
    {
        name: 'No Clicks Needed',
        description: 'Designed from the ground up to be fully operable without a mouse or keyboard.',
        icon: MousePointer2,
    },
    {
        name: 'Cross Platform (Soon)',
        description: 'Built on a scalable architecture ready to expand to Windows and Linux automation.',
        icon: Layers,
    },
];

export default function Features() {
    return (
        <div className="bg-gray-900 py-24 sm:py-32" id="features">
            <div className="mx-auto max-w-7xl px-4 lg:px-8">
                <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-semibold leading-7 text-blue-400">Capabilities</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        More than just a voice assistant.
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-400">
                        Juvenile isn't a chatbot. It's an agent that sees your screen and uses your tools for you.
                    </p>
                </div>
                <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
                    <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                        {features.map((feature) => (
                            <div key={feature.name} className="flex flex-col">
                                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                                    <feature.icon className="h-5 w-5 flex-none text-blue-400" aria-hidden="true" />
                                    {feature.name}
                                </dt>
                                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-400">
                                    <p className="flex-auto">{feature.description}</p>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    );
}
