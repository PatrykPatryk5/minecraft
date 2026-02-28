import React from 'react';
import useGameStore from '../store/gameStore';

interface Props {
    name: string;
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class SafeModuleErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Report crash to global store
        useGameStore.getState().reportModuleCrash(this.props.name, error);
    }

    render() {
        if (this.state.hasError) {
            // Render nothing in place, let the overlay handle the UI
            return null;
        }
        return this.props.children;
    }
}

const SafeModuleContainer: React.FC<Props> = ({ name, children }) => {
    // Subscribe to disabled state
    const moduleState = useGameStore(s => s.crashedModules[name]);

    if (moduleState?.disabled) {
        return null; // Do not render if explicitly disabled by user
    }

    return (
        <SafeModuleErrorBoundary name={name} key={moduleState?.timestamp || 0}>
            {children}
        </SafeModuleErrorBoundary>
    );
};

export default SafeModuleContainer;
