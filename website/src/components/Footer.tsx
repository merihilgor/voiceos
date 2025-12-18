import React from 'react';
import { Github, Twitter } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-gray-900 border-t border-gray-800">
            <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
                <div className="flex justify-center space-x-6 md:order-2">
                    <a href="https://github.com/merihilgor/voiceos" className="text-gray-500 hover:text-white">
                        <span className="sr-only">GitHub</span>
                        <Github className="h-6 w-6" aria-hidden="true" />
                    </a>
                </div>
                <div className="mt-8 md:order-1 md:mt-0">
                    <p className="text-center text-xs leading-5 text-gray-500">
                        &copy; {new Date().getFullYear()} VoiceOS (Juvenile). Open Source under MIT License.
                    </p>
                </div>
            </div>
        </footer>
    );
}
