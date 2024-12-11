import React, { createContext, useEffect, useState } from 'react';
import { DEFAULT_FRONTEND_CODE, FRONTEND_CODES, MARKETING_PARAM_NAME } from '@utils';
import { useRouter } from 'next/router';

interface FrontendCodeContextType {
    marketingCode: string;
    frontendCode: string;
}

export const FrontendCodeContext = createContext<FrontendCodeContextType | undefined>(undefined);

export const FrontendCodeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [marketingCode, setMarketingCode] = useState('');
    const [frontendCode, setFrontendCode] = useState('');
    const router = useRouter();

    useEffect(() => {
        const { [MARKETING_PARAM_NAME]: marketingParam, ...otherParams } = router.query;
        
        if (marketingParam) {
            router.replace(
                { pathname: router.pathname, query: otherParams },
                undefined,
                { shallow: true }
            );
        }

        setMarketingCode(marketingParam as string ?? '');
        setFrontendCode(FRONTEND_CODES[marketingParam as string ?? ''] ?? DEFAULT_FRONTEND_CODE);
    }, [router.isReady]);

    return (
        <FrontendCodeContext.Provider value={{ marketingCode, frontendCode }}>
            {children}
        </FrontendCodeContext.Provider>
    );
};
