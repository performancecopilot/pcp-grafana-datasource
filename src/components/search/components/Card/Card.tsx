import { Themeable, withTheme } from '@grafana/ui';
import React from 'react';
import { cardContainer } from './styles';

export interface CardBasicProps {
    background?: 'weak' | 'strong';
}

export type CardProps = Themeable & CardBasicProps;

export const Card: React.FC<CardProps> = props => {
    const background = props.background ?? 'strong';
    return (
        <div className={cardContainer(props.theme, background)} data-test={background}>
            {props.children}
        </div>
    );
};

export default withTheme(Card);
