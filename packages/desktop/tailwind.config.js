import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				gray: {
					50: '#f5f5f7',
					100: '#e5e5ea',
					200: '#d1d1d6',
					300: '#c7c7cc',
					400: '#aeaeb2',
					500: '#8e8e93',
					600: '#636366',
					700: '#48484a',
					800: '#3a3a3c',
					900: '#1d1d1f',
					950: '#1c1c1e',
				}
			},
			typography: {
				DEFAULT: {
					css: {
						pre: false,
						code: false,
						'pre code': false,
						'code::before': false,
						'code::after': false
					}
				}
			},
			padding: {
				'safe-bottom': 'env(safe-area-inset-bottom)'
			},
			transitionProperty: {
				width: 'width'
			}
		}
	},
	plugins: [typography, containerQueries]
};
