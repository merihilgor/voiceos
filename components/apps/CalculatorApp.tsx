
import React, { useState } from 'react';

export const CalculatorApp = () => {
    const [display, setDisplay] = useState('0');

    const handlePress = (val: string) => {
        setDisplay(prev => prev === '0' ? val : prev + val);
    };

    return (
        <div className="h-full w-full bg-gray-900 text-white p-4 flex flex-col font-mono">
            <div className="flex-1 bg-black/50 rounded mb-4 flex items-end justify-end p-4 text-4xl">
                {display}
            </div>
            <div className="grid grid-cols-4 gap-2 h-3/5">
                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map(btn => (
                    <button
                        key={btn}
                        onClick={() => btn === 'C' ? setDisplay('0') : handlePress(btn)}
                        className={`rounded flex items-center justify-center text-xl hover:bg-white/10 ${btn === '=' ? 'bg-blue-500' : 'bg-gray-800'}`}
                    >
                        {btn}
                    </button>
                ))}
            </div>
        </div>
    );
};
