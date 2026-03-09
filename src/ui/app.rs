use eframe::egui::{
    self, Align, Color32, CornerRadius, FontFamily, Frame, Layout, Margin, RichText, Stroke,
    TextStyle, Vec2,
};
use rfd::FileDialog;

use crate::{
    ApiKind, DeployRequest, ProbeResult, deploy_configuration,
    probe_endpoint,
};

fn surface_color() -> Color32 {
    Color32::from_rgb(16, 22, 34)
}

fn surface_soft_color() -> Color32 {
    Color32::from_rgb(22, 29, 43)
}

fn border_color() -> Color32 {
    Color32::from_rgb(48, 61, 84)
}

fn text_muted_color() -> Color32 {
    Color32::from_rgb(151, 166, 190)
}

fn primary_color() -> Color32 {
    Color32::from_rgb(64, 132, 255)
}

fn success_color() -> Color32 {
    Color32::from_rgb(52, 199, 132)
}

fn warn_color() -> Color32 {
    Color32::from_rgb(241, 183, 76)
}

fn danger_color() -> Color32 {
    Color32::from_rgb(234, 96, 96)
}

fn card_frame() -> Frame {
    Frame::new()
        .fill(surface_color())
        .stroke(Stroke::new(1.0, border_color()))
        .corner_radius(CornerRadius::same(18))
        .shadow(egui::epaint::Shadow {
            offset: [0, 10],
            blur: 24,
            spread: 0,
            color: Color32::from_black_alpha(72),
        })
        .inner_margin(Margin::same(18))
}

fn soft_frame(fill: Color32) -> Frame {
    Frame::new()
        .fill(fill)
        .stroke(Stroke::new(1.0, border_color()))
        .corner_radius(CornerRadius::same(14))
        .inner_margin(Margin::same(14))
}

fn section_header(ui: &mut egui::Ui, title: &str, description: &str) {
    ui.label(
        RichText::new(title)
            .size(20.0)
            .strong()
            .color(Color32::WHITE),
    );
    ui.label(
        RichText::new(description)
            .size(13.0)
            .color(text_muted_color()),
    );
}

fn status_chip(ui: &mut egui::Ui, text: &str, color: Color32) {
    Frame::new()
        .fill(surface_soft_color())
        .stroke(Stroke::new(1.0, color))
        .corner_radius(CornerRadius::same(22))
        .inner_margin(Margin::symmetric(10, 6))
        .show(ui, |ui| {
            ui.label(RichText::new(text).size(12.5).strong().color(color));
        });
}

fn metric_tile(ui: &mut egui::Ui, label: &str, value: &str, accent: Color32) {
    Frame::new()
        .fill(surface_soft_color())
        .stroke(Stroke::new(1.0, accent))
        .corner_radius(CornerRadius::same(14))
        .inner_margin(Margin::same(14))
        .show(ui, |ui| {
            ui.label(RichText::new(label).size(12.0).color(text_muted_color()));
            ui.add_space(4.0);
            ui.label(
                RichText::new(value)
                    .size(18.0)
                    .strong()
                    .color(Color32::WHITE),
            );
        });
}

fn info_row(ui: &mut egui::Ui, label: &str, value: &str, value_color: Color32) {
    ui.horizontal(|ui| {
        ui.label(RichText::new(label).size(13.0).color(text_muted_color()));
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            ui.label(RichText::new(value).size(13.5).strong().color(value_color));
        });
    });
}

fn field_title(ui: &mut egui::Ui, title: &str, description: &str) {
    ui.label(
        RichText::new(title)
            .size(14.0)
            .strong()
            .color(Color32::WHITE),
    );
    ui.label(
        RichText::new(description)
            .size(12.5)
            .color(text_muted_color()),
    );
    ui.add_space(6.0);
}

pub struct DeployerApp {
    openclaw_home: String,
    base_url: String,
    api_key: String,
    model: String,
    run_smoke_test: bool,
    last_probe: Option<ProbeResult>,
    logs: String,
}

impl Default for DeployerApp {
    fn default() -> Self {
        // 获取用户主目录（不包含 .openclaw）
        let home = dirs::home_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .display()
            .to_string();
        
        Self {
            openclaw_home: home,
            base_url: "https://front.work.zving.com/cpa/v1".to_string(),
            api_key: "sk-DT80WzyG7VovLbRLl".to_string(),
            model: "gpt-5.2".to_string(),
            run_smoke_test: false,
            last_probe: None,
            logs: "准备就绪。请输入请求地址、API Key、模型，然后点击“检测接口”或“一键部署”。"
                .to_string(),
        }
    }
}

impl DeployerApp {
    fn current_request(&self) -> DeployRequest {
        DeployRequest {
            openclaw_home: self.openclaw_home.trim().into(),
            base_url: self.base_url.trim().to_string(),
            api_key: self.api_key.trim().to_string(),
            model: self.model.trim().to_string(),
        }
    }

    fn push_log(&mut self, message: impl AsRef<str>) {
        if !self.logs.is_empty() {
            self.logs.push('\n');
        }
        self.logs.push_str(message.as_ref());
    }

    fn pick_openclaw_home(&mut self) {
        if let Some(path) = FileDialog::new()
            .set_directory(&self.openclaw_home)
            .pick_folder()
        {
            self.openclaw_home = path.display().to_string();
        }
    }

    fn detect_api(&mut self) {
        let request = self.current_request();
        match probe_endpoint(&request) {
            Ok(result) => {
                self.last_probe = Some(result.clone());
                self.push_log(format!(
                    "接口探测成功：{} ({})",
                    result.api_kind.label(),
                    result.api_kind.as_str()
                ));
                for note in result.notes {
                    self.push_log(format!("- {note}"));
                }
            }
            Err(error) => {
                self.last_probe = None;
                self.push_log(format!("接口探测失败：{error:#}"));
            }
        }
    }

    fn deploy(&mut self) {
        let request = self.current_request();
        let api_kind = match self.last_probe.as_ref().map(|probe| probe.api_kind) {
            Some(api_kind) => api_kind,
            None => match probe_endpoint(&request) {
                Ok(result) => {
                    self.push_log(format!(
                        "未发现缓存探测结果，已自动探测：{} ({})",
                        result.api_kind.label(),
                        result.api_kind.as_str()
                    ));
                    for note in &result.notes {
                        self.push_log(format!("- {note}"));
                    }
                    let api_kind = result.api_kind;
                    self.last_probe = Some(result);
                    api_kind
                }
                Err(error) => {
                    self.push_log(format!("部署前自动探测失败：{error:#}"));
                    return;
                }
            },
        };

        match deploy_configuration(&request, api_kind, self.run_smoke_test) {
            Ok(report) => {
                self.push_log(format!("部署完成，API 类型：{}", report.api_kind.as_str()));
                for path in report.written_files {
                    self.push_log(format!("已写入：{}", path.display()));
                }
                if report.backup_files.is_empty() {
                    self.push_log("本次没有生成备份文件（目标文件此前不存在）。");
                } else {
                    for path in report.backup_files {
                        self.push_log(format!("已备份：{}", path.display()));
                    }
                }

                if let Some(smoke_test) = report.smoke_test {
                    if smoke_test.success {
                        self.push_log(format!("OpenClaw 冒烟测试通过：{}", smoke_test.text.trim()));
                    } else {
                        self.push_log(format!(
                            "OpenClaw 冒烟测试失败。返回：{}",
                            smoke_test.text.trim()
                        ));
                        self.push_log("原始输出如下：");
                        self.push_log(smoke_test.raw_output);
                    }
                }
            }
            Err(error) => self.push_log(format!("部署失败：{error:#}")),
        }
    }

    fn probe_badge(&self) -> (&'static str, Color32) {
        match self.last_probe.as_ref().map(|probe| probe.api_kind) {
            Some(ApiKind::OpenAiResponses) => ("已识别：openai-responses", success_color()),
            Some(ApiKind::OpenAiCompletions) => ("已识别：openai-completions", primary_color()),
            None => ("尚未探测接口", warn_color()),
        }
    }

    fn open_openclaw(&mut self) {
        use std::process::Command;
        
        let openclaw_home = self.openclaw_home.trim().to_string();
        
        #[cfg(target_os = "windows")]
        {
            match Command::new("cmd")
                .args(["/C", "start", "cmd", "/K", &format!("set OPENCLAW_HOME={} && openclaw tui", openclaw_home)])
                .spawn()
            {
                Ok(_) => {
                    self.push_log("正在打开 OpenClaw TUI（终端界面）...");
                    self.push_log("提示：需要先启动 Gateway 才能使用");
                }
                Err(error) => {
                    self.push_log(format!("打开 TUI 失败：{error}"));
                }
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            match Command::new("openclaw")
                .args(["tui"])
                .env("OPENCLAW_HOME", &openclaw_home)
                .spawn()
            {
                Ok(_) => {
                    self.push_log("正在打开 OpenClaw TUI...");
                }
                Err(error) => {
                    self.push_log(format!("打开 TUI 失败：{error}"));
                }
            }
        }
    }

    fn start_gateway(&mut self) {
        use std::process::Command;
        
        let openclaw_home = self.openclaw_home.trim().to_string();
        
        #[cfg(target_os = "windows")]
        {
            // 使用 --allow-unconfigured 和 --token 参数启动 Gateway
            let token = "8405298020d438285b54330366094fade4f8adaee0d00377";
            match Command::new("cmd")
                .args(["/C", "start", "cmd", "/K", &format!("set OPENCLAW_HOME={} && openclaw gateway --allow-unconfigured --token {}", openclaw_home, token)])
                .spawn()
            {
                Ok(_) => {
                    self.push_log("正在启动 OpenClaw Gateway...");
                    self.push_log("Gateway 将在新窗口中运行，监听 ws://127.0.0.1:18789");
                    self.push_log("启动完成后，可以点击【打开 TUI】使用 OpenClaw");
                }
                Err(error) => {
                    self.push_log(format!("启动 Gateway 失败：{error}"));
                    self.push_log("请确保已安装 OpenClaw CLI");
                }
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            let token = "8405298020d438285b54330366094fade4f8adaee0d00377";
            match Command::new("openclaw")
                .args(["gateway", "--allow-unconfigured", "--token", token])
                .env("OPENCLAW_HOME", &openclaw_home)
                .spawn()
            {
                Ok(_) => {
                    self.push_log("正在启动 OpenClaw Gateway...");
                }
                Err(error) => {
                    self.push_log(format!("启动 Gateway 失败：{error}"));
                }
            }
        }
    }

    fn render_hero(&self, ui: &mut egui::Ui) {
        let (badge_text, badge_color) = self.probe_badge();
        let model_text = if self.model.trim().is_empty() {
            "待填写"
        } else {
            self.model.trim()
        };

        card_frame().show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(RichText::new("桌面部署工具").size(13.0).strong().color(primary_color()));
                    ui.label(RichText::new("OpenClaw 一键部署").size(30.0).strong().color(Color32::WHITE));
                    ui.add_space(4.0);
                    ui.label(
                        RichText::new(
                            "只输入请求地址、API Key 和模型，程序会自动探测接口类型，并把配置写入本地 OpenClaw。",
                        )
                        .size(14.0)
                        .color(text_muted_color()),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::TOP), |ui| {
                    status_chip(ui, badge_text, badge_color);
                    status_chip(ui, "Provider：desktopdeploy", primary_color());
                    status_chip(
                        ui,
                        if self.run_smoke_test {
                            "部署后执行冒烟测试"
                        } else {
                            "本次仅写入配置"
                        },
                        if self.run_smoke_test {
                            success_color()
                        } else {
                            warn_color()
                        },
                    );
                });
            });

            ui.add_space(14.0);
            ui.columns(3, |columns| {
                metric_tile(&mut columns[0], "当前 API 类型", badge_text, badge_color);
                metric_tile(&mut columns[1], "计划部署模型", model_text, primary_color());
                metric_tile(
                    &mut columns[2],
                    "目标 Agent",
                    "main",
                    Color32::from_rgb(158, 127, 255),
                );
            });
        });
    }

    fn render_form_card(&mut self, ui: &mut egui::Ui) {
        card_frame().show(ui, |ui| {
            section_header(ui, "部署配置", "填写连接信息后，可先探测接口，再执行一键部署。还会自动生成旧配置备份。" );
            ui.add_space(8.0);

            field_title(ui, "OpenClaw 目录", "默认指向当前 Windows 用户的 .openclaw 目录。可以切换到别的配置目录。" );
            ui.horizontal(|ui| {
                let input_width = (ui.available_width() - 118.0).max(180.0);
                ui.add_sized(
                    [input_width, 40.0],
                    egui::TextEdit::singleline(&mut self.openclaw_home),
                );
                if ui
                    .add(
                        egui::Button::new(RichText::new("选择目录").strong())
                            .min_size(Vec2::new(104.0, 40.0))
                            .corner_radius(CornerRadius::same(12)),
                    )
                    .clicked()
                {
                    self.pick_openclaw_home();
                }
            });

            ui.add_space(8.0);
            field_title(ui, "请求地址", "例如：https://api.example.com/v1。程序会自动尝试 /models、/responses、/chat/completions。" );
            ui.add_sized(
                [ui.available_width(), 40.0],
                egui::TextEdit::singleline(&mut self.base_url)
                    .hint_text("例如：https://www.right.codes/codex/v1"),
            );

            ui.add_space(8.0);
            field_title(ui, "API Key", "用于调用目标接口。输入框默认隐藏内容。" );
            ui.add_sized(
                [ui.available_width(), 40.0],
                egui::TextEdit::singleline(&mut self.api_key).password(true),
            );

            ui.add_space(8.0);
            field_title(ui, "模型", "例如：gpt-5.4。最终会写成 desktopdeploy/<模型名>。" );
            ui.add_sized(
                [ui.available_width(), 40.0],
                egui::TextEdit::singleline(&mut self.model).hint_text("例如：gpt-5.4"),
            );

            soft_frame(surface_soft_color()).show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new("固定 Provider").size(13.0).color(text_muted_color()));
                    ui.label(
                        RichText::new("desktopdeploy")
                            .family(FontFamily::Monospace)
                            .strong()
                            .color(Color32::WHITE),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.checkbox(&mut self.run_smoke_test, "部署后执行 OpenClaw 冒烟测试");
                    });
                });
            });

            ui.add_space(10.0);
            ui.horizontal_wrapped(|ui| {
                if ui
                    .add(
                        egui::Button::new(RichText::new("检测接口").size(16.0).strong())
                            .fill(Color32::from_rgb(33, 78, 150))
                            .stroke(Stroke::new(1.0, Color32::from_rgb(118, 176, 255)))
                            .min_size(Vec2::new(150.0, 44.0))
                            .corner_radius(CornerRadius::same(12)),
                    )
                    .clicked()
                {
                    self.detect_api();
                }

                if ui
                    .add(
                        egui::Button::new(RichText::new("一键部署").size(16.0).strong())
                            .fill(primary_color())
                            .stroke(Stroke::new(1.0, Color32::from_rgb(156, 204, 255)))
                            .min_size(Vec2::new(170.0, 44.0))
                            .corner_radius(CornerRadius::same(12)),
                    )
                    .clicked()
                {
                    self.deploy();
                }

                if ui
                    .add(
                        egui::Button::new(RichText::new("启动 Gateway").size(16.0).strong())
                            .fill(Color32::from_rgb(52, 199, 132))
                            .stroke(Stroke::new(1.0, Color32::from_rgb(134, 239, 172)))
                            .min_size(Vec2::new(170.0, 44.0))
                            .corner_radius(CornerRadius::same(12)),
                    )
                    .clicked()
                {
                    self.start_gateway();
                }

                if ui
                    .add(
                        egui::Button::new(RichText::new("打开 TUI").size(16.0).strong())
                            .fill(Color32::from_rgb(88, 166, 255))
                            .stroke(Stroke::new(1.0, Color32::from_rgb(173, 214, 255)))
                            .min_size(Vec2::new(150.0, 44.0))
                            .corner_radius(CornerRadius::same(12)),
                    )
                    .clicked()
                {
                    self.open_openclaw();
                }
            });
        });
    }

    fn render_status_card(&self, ui: &mut egui::Ui) {
        card_frame().show(ui, |ui| {
            section_header(ui, "当前状态", "这里会展示最近一次探测结果，方便你确认接口是否能用。" );
            ui.add_space(8.0);

            let (badge_text, badge_color) = self.probe_badge();
            info_row(ui, "接口探测", badge_text, badge_color);

            if let Some(probe) = &self.last_probe {
                info_row(
                    ui,
                    "GET /models",
                    if probe.models_available {
                        "可访问"
                    } else {
                        "不可访问或未返回成功"
                    },
                    if probe.models_available {
                        success_color()
                    } else {
                        warn_color()
                    },
                );
                info_row(
                    ui,
                    "目标模型",
                    if probe.model_found {
                        "已在返回列表中找到"
                    } else {
                        "未确认存在"
                    },
                    if probe.model_found {
                        success_color()
                    } else {
                        warn_color()
                    },
                );

                ui.add_space(8.0);
                soft_frame(surface_soft_color()).show(ui, |ui| {
                    ui.label(RichText::new("探测说明").size(13.5).strong().color(Color32::WHITE));
                    ui.add_space(6.0);
                    for note in &probe.notes {
                        ui.label(RichText::new(format!("• {note}")).size(12.5).color(text_muted_color()));
                    }
                });
            } else {
                ui.add_space(8.0);
                soft_frame(surface_soft_color()).show(ui, |ui| {
                    ui.label(
                        RichText::new(
                            "还没有探测结果。点击左侧“检测接口”后，这里会显示接口类型、模型是否存在，以及接口返回的关键信息。",
                        )
                        .size(12.5)
                        .color(text_muted_color()),
                    );
                });
            }
        });
    }

    fn render_targets_card(&self, ui: &mut egui::Ui) {
        let base = self.openclaw_home.trim();
        let targets = [
            format!("{base}\\openclaw.json"),
            format!("{base}\\agents\\main\\agent\\models.json"),
            format!("{base}\\agents\\main\\agent\\auth-profiles.json"),
        ];

        card_frame().show(ui, |ui| {
            section_header(
                ui,
                "写入目标",
                "部署时会更新以下文件；如果原文件已存在，会先生成时间戳备份。",
            );
            ui.add_space(8.0);

            for path in targets {
                soft_frame(surface_soft_color()).show(ui, |ui| {
                    ui.label(
                        RichText::new(path)
                            .size(12.5)
                            .family(FontFamily::Monospace)
                            .color(Color32::WHITE),
                    );
                });
            }
        });
    }

    fn render_logs_card(&mut self, ui: &mut egui::Ui) {
        card_frame().show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new("运行日志")
                            .size(20.0)
                            .strong()
                            .color(Color32::WHITE),
                    );
                    ui.label(
                        RichText::new("探测结果、写入路径、备份信息与冒烟测试输出都会记录在这里。")
                            .size(13.0)
                            .color(text_muted_color()),
                    );
                });

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if ui
                        .add(
                            egui::Button::new(RichText::new("清空日志").strong())
                                .fill(Color32::from_rgb(76, 40, 40))
                                .stroke(Stroke::new(1.0, danger_color()))
                                .corner_radius(CornerRadius::same(12)),
                        )
                        .clicked()
                    {
                        self.logs.clear();
                    }
                });
            });

            ui.add_space(10.0);
            ui.add_sized(
                [ui.available_width(), 280.0],
                egui::TextEdit::multiline(&mut self.logs)
                    .font(TextStyle::Monospace)
                    .desired_rows(16)
                    .desired_width(f32::INFINITY),
            );
        });
    }
}

impl eframe::App for DeployerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default()
            .frame(
                Frame::new()
                    .fill(Color32::from_rgb(9, 12, 20))
                    .inner_margin(Margin::same(18)),
            )
            .show(ctx, |ui| {
                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        self.render_hero(ui);
                        ui.add_space(16.0);

                        ui.columns(2, |columns| {
                            self.render_form_card(&mut columns[0]);
                            columns[0].add_space(16.0);
                            self.render_logs_card(&mut columns[0]);

                            self.render_status_card(&mut columns[1]);
                            columns[1].add_space(16.0);
                            self.render_targets_card(&mut columns[1]);
                        });
                    });
            });
    }
}
