import {Portal} from '@gorhom/portal';
import React from 'react';
import BaseAutoCompleteSuggestions from './BaseAutoCompleteSuggestions';
import type {AutoCompleteSuggestionsProps} from './types';
import { PressableWithoutFeedback } from '@components/Pressable';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';

type AdditionalSuggestionsProps = {
    onClose: () => void;
}
function AutoCompleteSuggestions<TSuggestion>({measureParentContainer, onClose, ...props}: AutoCompleteSuggestionsProps<TSuggestion> & AdditionalSuggestionsProps) {
    const {windowHeight} = useWindowDimensions();
    const styles = useThemeStyles();
    return (
        <Portal hostName="suggestions">
            {props.suggestions?.length > 0 && (
                <PressableWithoutFeedback
                    accessible={false}
                    style={[styles.autoCompleteOutsideContainer, {top: -windowHeight, height: windowHeight, zIndex: -99}]}
                    onPress={onClose}
                />
            )}
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <BaseAutoCompleteSuggestions<TSuggestion> {...props} />
        </Portal>
    );
}

AutoCompleteSuggestions.displayName = 'AutoCompleteSuggestions';

export default AutoCompleteSuggestions;
