import _ from 'underscore';
import React from 'react';
import {TNodeChildrenRenderer, splitBoxModelStyle} from 'react-native-render-html';
import htmlRendererPropTypes from './htmlRendererPropTypes';
// import Text from '../../Text';
import {View} from 'react-native';

const CodeRenderer = (props) => {
    // We split wrapper and inner styles
    // "boxModelStyle" corresponds to border, margin, padding and backgroundColor
    const {boxModelStyle, otherStyle: textStyle} = splitBoxModelStyle(props.style);

    const defaultRendererProps = _.omit(props, ['TDefaultRenderer', 'style']);

    return (
        <View style={{...boxModelStyle}}>
            <TNodeChildrenRenderer tnode={defaultRendererProps.tnode} />
        </View>
    );
};

CodeRenderer.propTypes = htmlRendererPropTypes;
CodeRenderer.displayName = 'HeaderRender';

export default CodeRenderer;
