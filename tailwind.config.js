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
			sans: ["Avenir", "Helvetica", "ui-sans-serif"],
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
			transitionProperty: {
				height: "height",
			},
			colors: {
				layout: {
					primary: "#f5f6f9",
					secondary: "#F57F00",
					footer: "#272B38",
				},
				menu: {
					default: {
						text: "#272b37",
						bg: "#ffffff",
					},
					hover: {
						text: "#1d2029",
						bg: "#f5f6f9",
					},
					active: {
						text: "#1d2029",
						bg: "#f0f1f5",
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
						secondary: "#F57F00",
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
					labelButton: "#F57F00",
				},
				borders: {
					primary: '#e9ebf0',
					secondary: '#ced0da',
					tertiary: '#8b91a7',
					input: '#adb2c1',
					focus: '#F57F00',
					divider: '#1e293b',
					dividerLight: '#eaebf0',
				},
				input: {
					border: "#B7B7B7",
					placeholder: "#C5C5C5",
					primary: "#131313",
					label: "#adb2c1",
					bg: "#ffffff",
					borderFocus: "#FFA33B",
					borderHover: "#6D6D6D",
					bgNotEditable: "#F6F6F6",
				},
				button: {
					max: {
						bg: "#FDF2E2",
						text: "#FFA33B",
						hover: "#FDF2E2",
						disabledBg: "#ECECEC",
						disabledText: "#C5C5C5",
					},
					primary: {
						disabled: {
							text: "#C5C5C5",
							bg: "#ECECEC",
						},
						default: {
							text: "#ffffff",
							bg: "#F7911A",
						},
						hover: {
							text: "#ffffff",
							bg: "#F57F00",
						},
					},
					secondary: {
						disabled: {
							text: "#ADB2C2",
							bg: "##F5F6F9",
						},
						default: {
							text: "#272B38",
							bg: "#F5F6F9",
						},
						hover: {
							text: "#272B38",
							bg: "#EAEBF0",
						},
					},
					text:{
						default: {
							text: "#272B38",
						},
						hover: {
							text: "#F57F00",
						},
						disabled: {
							text: "#ADB2C2",
						},
					},
					textGroup: {
						primary: {
							text: "#F57F00",
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
				orangePalette: {
					"pale-orange": "var(--Orange-palette-Pale-orange, #FDF2E2)",
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
