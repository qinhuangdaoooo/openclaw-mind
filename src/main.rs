use eframe::egui;
use openclaw_desktop_deployer::ui::DeployerApp;
use std::fs;
use std::sync::Arc;

fn install_chinese_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();

    let candidates = [
        ("windows_simhei", r"C:\Windows\Fonts\simhei.ttf"),
        ("windows_simsun_bold", r"C:\Windows\Fonts\simsunb.ttf"),
        ("windows_simsun_ext", r"C:\Windows\Fonts\SimsunExtG.ttf"),
    ];

    let mut installed = Vec::new();

    for (name, path) in candidates {
        if let Ok(bytes) = fs::read(path) {
            fonts
                .font_data
                .insert(name.to_owned(), Arc::new(egui::FontData::from_owned(bytes)));
            installed.push(name.to_owned());
        }
    }

    if installed.is_empty() {
        return;
    }

    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
        for name in installed.iter().rev() {
            family.insert(0, name.clone());
        }
    }

    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
        for name in &installed {
            family.push(name.clone());
        }
    }

    ctx.set_fonts(fonts);
}

fn configure_theme(ctx: &egui::Context) {
    ctx.set_theme(egui::Theme::Dark);

    let mut visuals = egui::Visuals::dark();
    visuals.panel_fill = egui::Color32::from_rgb(9, 12, 20);
    visuals.window_fill = egui::Color32::from_rgb(16, 22, 34);
    visuals.window_corner_radius = egui::CornerRadius::same(18);
    visuals.menu_corner_radius = egui::CornerRadius::same(14);
    visuals.window_shadow = egui::epaint::Shadow {
        offset: [0, 10],
        blur: 28,
        spread: 0,
        color: egui::Color32::from_black_alpha(120),
    };
    visuals.popup_shadow = egui::epaint::Shadow {
        offset: [0, 8],
        blur: 24,
        spread: 0,
        color: egui::Color32::from_black_alpha(96),
    };
    visuals.selection.bg_fill = egui::Color32::from_rgb(58, 126, 255);
    visuals.selection.stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(173, 214, 255));

    visuals.widgets.noninteractive.bg_fill = egui::Color32::from_rgb(20, 27, 40);
    visuals.widgets.noninteractive.weak_bg_fill = egui::Color32::from_rgb(20, 27, 40);
    visuals.widgets.noninteractive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(44, 58, 82));
    visuals.widgets.noninteractive.fg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(222, 228, 239));
    visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::same(12);

    visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(24, 32, 47);
    visuals.widgets.inactive.weak_bg_fill = egui::Color32::from_rgb(24, 32, 47);
    visuals.widgets.inactive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(52, 67, 95));
    visuals.widgets.inactive.fg_stroke = egui::Stroke::new(1.0, egui::Color32::WHITE);
    visuals.widgets.inactive.corner_radius = egui::CornerRadius::same(12);

    visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(31, 42, 61);
    visuals.widgets.hovered.weak_bg_fill = egui::Color32::from_rgb(31, 42, 61);
    visuals.widgets.hovered.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(93, 132, 199));
    visuals.widgets.hovered.fg_stroke = egui::Stroke::new(1.0, egui::Color32::WHITE);
    visuals.widgets.hovered.corner_radius = egui::CornerRadius::same(12);

    visuals.widgets.active.bg_fill = egui::Color32::from_rgb(43, 97, 184);
    visuals.widgets.active.weak_bg_fill = egui::Color32::from_rgb(43, 97, 184);
    visuals.widgets.active.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(131, 188, 255));
    visuals.widgets.active.fg_stroke = egui::Stroke::new(1.0, egui::Color32::WHITE);
    visuals.widgets.active.corner_radius = egui::CornerRadius::same(12);
    visuals.widgets.open = visuals.widgets.active;

    ctx.set_visuals(visuals);

    ctx.style_mut(|style| {
        style.spacing.item_spacing = egui::vec2(14.0, 14.0);
        style.spacing.button_padding = egui::vec2(16.0, 11.0);
        style.spacing.interact_size = egui::vec2(44.0, 40.0);
        style.spacing.window_margin = egui::Margin::same(16);
        style.spacing.menu_margin = egui::Margin::same(12);

        style.text_styles.insert(
            egui::TextStyle::Heading,
            egui::FontId::new(28.0, egui::FontFamily::Proportional),
        );
        style.text_styles.insert(
            egui::TextStyle::Body,
            egui::FontId::new(16.0, egui::FontFamily::Proportional),
        );
        style.text_styles.insert(
            egui::TextStyle::Button,
            egui::FontId::new(16.0, egui::FontFamily::Proportional),
        );
        style.text_styles.insert(
            egui::TextStyle::Monospace,
            egui::FontId::new(15.0, egui::FontFamily::Monospace),
        );
        style.text_styles.insert(
            egui::TextStyle::Small,
            egui::FontId::new(13.0, egui::FontFamily::Proportional),
        );
    });
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1040.0, 820.0])
            .with_min_inner_size([920.0, 720.0]),
        ..Default::default()
    };

    eframe::run_native(
        "OpenClaw 一键部署",
        options,
        Box::new(|creation_context| {
            install_chinese_fonts(&creation_context.egui_ctx);
            configure_theme(&creation_context.egui_ctx);
            Ok(Box::new(DeployerApp::default()))
        }),
    )
}
