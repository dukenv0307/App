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
import BaseMiniContextMenuItem from './BaseMiniContextMenuItem';
import getButtonState from '../libs/getButtonState';
import { withDelayToggleButtonStatePropTypes } from './withDelayToggleButtonState';
import compose from '../libs/compose';
import withDelayToggleButtonState from './withDelayToggleButtonState';
import { View } from 'react-native';

const propTypes = {
    /** The text to display and copy to the clipboard */
    text: PropTypes.string.isRequired,

    /** Styles to apply to the text */
    // eslint-disable-next-line react/forbid-prop-types
    textStyles: PropTypes.arrayOf(PropTypes.object),

    ...withLocalizePropTypes,
    ...withDelayToggleButtonStatePropTypes,
};

const defaultProps = {
    textStyles: [],
    autoReset: true
};

class CopyTextToClipboard extends React.Component {
    constructor(props) {
        super(props);

        this.copyToClipboard = this.copyToClipboard.bind(this);
        this.triggerPressAndUpdateSuccess = this.triggerPressAndUpdateSuccess.bind(this);

        this.state = {
            showCheckmark: false,
        };
    }

    /**
     * Method to call parent onPress and toggleDelayButtonState
     */
    triggerPressAndUpdateSuccess() {
        if (this.props.isDelayButtonStateComplete) {
            return;
        }
        this.copyToClipboard();
        this.props.toggleDelayButtonState(this.props.autoReset);
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
        const icon = (this.props.isDelayButtonStateComplete || this.state.showCheckmark) ? Expensicons.Checkmark : Expensicons.Copy;
        return (
            <View
                style={[styles.flexRow, styles.cursorPointer, styles.alignItemsCenter]}
            >
                <Text style={this.props.textStyles}>{this.props.text}</Text>
                <BaseMiniContextMenuItem 
                    tooltipText={tooltipText}
                    onPress={this.triggerPressAndUpdateSuccess}
                    isDelayButtonStateComplete={this.props.isDelayButtonStateComplete}
                >
                    {({hovered, pressed}) => (
                        <Icon
                            src={icon}
                            fill={StyleUtils.getIconFillColor(getButtonState(hovered, pressed, this.props.isDelayButtonStateComplete))}
                            width={variables.iconSizeSmall}
                            height={variables.iconSizeSmall}
                        />
                    )}   
                </BaseMiniContextMenuItem>
            </View>
        );
    }
}

CopyTextToClipboard.propTypes = propTypes;
CopyTextToClipboard.defaultProps = defaultProps;

export default compose(
    withLocalize,
    withDelayToggleButtonState
)(CopyTextToClipboard);
