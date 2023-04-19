import React from 'react';
import PropTypes from 'prop-types';
import Text from './Text';
import * as Expensicons from './Icon/Expensicons';
import Clipboard from '../libs/Clipboard';
import Icon from './Icon';
import styles from '../styles/styles';
import * as StyleUtils from '../styles/StyleUtils';
import variables from '../styles/variables';
import withLocalize, {withLocalizePropTypes} from './withLocalize';
import getButtonState from '../libs/getButtonState';
import { withDelayToggleButtonStatePropTypes } from './withDelayToggleButtonState';
import compose from '../libs/compose';
import { Pressable, View } from 'react-native';
import Tooltip from './Tooltip';

const propTypes = {
    /** The text to display and copy to the clipboard */
    text: PropTypes.string.isRequired,

    /** Styles to apply to the text */
    // eslint-disable-next-line react/forbid-prop-types
    textStyles: PropTypes.arrayOf(PropTypes.object),

    ...withLocalizePropTypes,
};

const defaultProps = {
    textStyles: [],
};

class CopyTextToClipboard extends React.Component {
    constructor(props) {
        super(props);

        this.copyToClipboard = this.copyToClipboard.bind(this);

        this.state = {
            showCheckmark: false,
        };
    }

    componentWillUnmount() {
        // Clear the interval when the component unmounts so that if the user navigates
        // away quickly, then setState() won't try to update a component that's been unmounted
        clearInterval(this.showCheckmarkInterval);
    }

    copyToClipboard() {
        Clipboard.setString(this.props.text);
        this.setState({showCheckmark: true}, () => {
            this.showCheckmarkInterval = setTimeout(() => {
                this.setState({showCheckmark: false});
            }, 1800);
        });
    }

    render() {
        const tooltipText = this.props.translate(`reportActionContextMenu.${this.state.showCheckmark ? 'copied' : 'copyToClipboard'}`);
        const icon = this.state.showCheckmark ? Expensicons.Checkmark : Expensicons.Copy;
        return (
            <Text
                style={[styles.flexRow, styles.cursorPointer]}
                suppressHighlighting
            >
                <Text style={this.props.textStyles}>{`${this.props.text} `}</Text>
                <Tooltip text={tooltipText}>
                    <Pressable
                        focusable
                        onPress={this.copyToClipboard}
                        accessibilityLabel={tooltipText}
                        style={
                            ({hovered, pressed}) => [
                                styles.p1,
                                {borderRadius: 100},
                                StyleUtils.getButtonBackgroundColorStyle(getButtonState(hovered, pressed, this.state.showCheckmark)),
                            ]
                        }
                    >
                        {({hovered, pressed}) => (
                            <Icon
                                src={icon}
                                fill={StyleUtils.getIconFillColor(getButtonState(hovered, pressed, this.state.showCheckmark))}
                                width={variables.iconSizeSmall}
                                height={variables.iconSizeSmall}
                                inline
                            />
                        )} 
                    </Pressable>
                </Tooltip>
            </Text>
        );
    }
}

CopyTextToClipboard.propTypes = propTypes;
CopyTextToClipboard.defaultProps = defaultProps;

export default compose(
    withLocalize,
)(CopyTextToClipboard);
