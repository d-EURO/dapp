/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./node_modules/flowbite-react/lib/**/*.js"],
	safelist: [
		{
			pattern: /grid-cols-/,
			variants: ["sm", "md", "lg", "xl", "2xl"],
		},
	],
	theme: {
		fontFamily: {
			sans: ["Inter", "Helvetica", "ui-sans-serif"],
		},
		screens: {
			xs: "480px",
			sm: "640px",
			md: "768px",
			"2md": "1000px",
			lg: "1024px",
			xl: "1280px",
			"2xl": "1536px",
		},
		extend: {
			height: {
				main: "calc(100vh)",
			},
			minHeight: {
				content: "calc(100vh - 230px)",
			},
			spacing: {
				"spacing-10": "40px",
			},
			transitionProperty: {
				height: "height",
			},
			colors: {
				gray: {
					"palette-75": "#6d6d6d",
				},
				neutral: {
					"palette-n-78": "#656565",
				},
				layout: {
					primary: "#f5f6f9",
					secondary: "#092f62",
					footer: "#272B38",
				},
				menu: {
					default: {
						text: "var(--Gray-palette-95, #272b37)",
						bg: "transparent",
					},
					hover: {
						text: "var(--Gray-palette-95, #272b37)",
						bg: "var(--Gray-palette-5, #F6F6F6)",
					},
					active: {
						text: "var(--Neutral-palette-n100, #131313)",
						bg: "var(--Gray-palette-5, #F6F6F6)",
					},
					disabled: {
						text: "var(--Gray-palette-40, #b3b3b3)",
						bg: "transparent",
					},
					separator: "#e9ebf0",
					back: "#FFFFFF",
					wallet: {
						bg: "#e4e6eb",
						border: "#ced0da",
						addressborder: "#8b91a7",
					},
				},
				card: {
					body: {
						primary: "#ffffff",
						secondary: "#092f62",
						seperator: "#1e293b",
					},
					content: {
						primary: "#e7e7ea",
						secondary: "#f7f7f9",
						highlight: "#ff293b",
					},
				},
				text: {
					header: "#8b91a7",
					subheader: "#8b91a7",
					active: "#ff44dd",
					primary: "#272b37",
					secondary: "#e2e8f0",
					tertiary: "#272b38",
					warning: "#ef4444",
					success: "#22c55e",
					icon: "#adb2c1",
					muted:"#8b91a7",
					muted2: "#8B92A8",
					muted3: "#ADB2C2",
					error: "#e02523",
					label: "#5c637b",
					title: "#43495c",
					disabled: "#5d647b",
					labelButton: "#065DC1",
				},
				borders: {
					primary: '#e9ebf0',
					secondary: '#ced0da',
					tertiary: '#8b91a7',
					input: '#adb2c1',
					focus: '#3d89f4',
					divider: '#1e293b',
					dividerLight: '#eaebf0',
				},
				input: {
					border: "#adb2c1",
					placeholder: "#bdc1cd",
					primary: "#1d2029",
					label: "#adb2c1",
					bg: "#f5f6f9",
					borderFocus: "#3d89f4",
					borderHover: "#5D647B",
					bgNotEditable: "#F5F6F9",
				},
				button: {
					max: {
						bg: "#e4f0fb",
						text: "#092f62",
						hover: "#CCE4FF",
						disabledBg: "#E9EBF0",
						disabledText: "#ADB2C2",
					},
					primary: {
						disabled: {
							text: "var(--Gray-palette-40, #C5C5C5)",
							bg: "var(--Gray-palette-10, #ECECEC)",
						},
						default: {
							text: "var(--Gray-palette-White, #FFF)",
							bg: "var(--Brand-colors-Citrus-orange, #F7911A)",
						},
						hover: {
							text: "var(--Gray-palette-White, #FFF)",
							bg: "var(--Brand-colors-Juice-orange, #F57F00)",
						},
					},
					secondary: {
						disabled: {
							text: "var(--Gray-palette-40, #C5C5C5)",
							bg: "var(--Gray-palette-5, #F6F6F6)",
						},
						default: {
							text: "var(--Gray-palette-90, #424242)",
							bg: "var(--Gray-palette-7, #F1F1F1)",
						},
						hover: {
							text: "var(--Gray-palette-90, #424242)",
							bg: "var(--Gray-palette-15, #E7E7E7)",
						},
					},
					text:{
						default: {
							text: "#272B38",
						},
						hover: {
							text: "#F7911A",
						},
						disabled: {
							text: "#ADB2C2",
						},
					},
					textGroup: {
						primary: {
							text: "#065DC1",
						},
						secondary: {
							text: "#8B92A8",
						},
						hover: {
							text: "#272b37",
						},
					},
				},
				table: {
					header: {
						primary: "#FFFFFF",
						secondary: "#F0F1F5",
						active: "#272b38",
						action: "#ced0da",
						default: "#CED1DA",
						hover: "#8B92A8"
					},
					row: {
						primary: "#FFFFFF",
						secondary: "#F0F1F5",
						hover: "#F0F1F5",
					},
				},
			},
			boxShadow: {
				'card': '0px 0px 16px 0px rgba(0,0,0,0.08), 0px 1px 4px 0px rgba(0,0,0,0.03)',
			},
		},
	},
	darkMode: "class",
	plugins: [require("flowbite/plugin")({ charts: true })],
};
