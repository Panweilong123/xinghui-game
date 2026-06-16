import json
import math
import random
import time
import tkinter as tk
from pathlib import Path


WIDTH = 960
HEIGHT = 540
SAVE_FILE = Path(__file__).with_name("stardash_save.json")


def clamp(value, low, high):
    return max(low, min(high, value))


def distance(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


class StarDash:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("星尘穿梭 - Python桌面版")
        self.root.resizable(False, False)
        self.root.configure(bg="#101015")

        self.canvas = tk.Canvas(
            self.root,
            width=WIDTH,
            height=HEIGHT,
            bg="#080b12",
            highlightthickness=0,
        )
        self.canvas.grid(row=0, column=0, padx=16, pady=16)

        self.panel = tk.Frame(self.root, width=260, bg="#191b22")
        self.panel.grid(row=0, column=1, sticky="ns", padx=(0, 16), pady=16)
        self.panel.grid_propagate(False)

        self.score_var = tk.StringVar(value="0")
        self.best_var = tk.StringVar(value="0")
        self.lives_var = tk.StringVar(value="3")
        self.level_var = tk.StringVar(value="1")
        self.status_var = tk.StringVar(value="点击开始，录一局漂亮的")

        self.build_panel()
        self.bind_events()
        self.load_save()
        self.reset_soft()
        self.draw_start_screen()

    def build_panel(self):
        tk.Label(
            self.panel,
            text="星尘穿梭",
            bg="#191b22",
            fg="#f5f7fb",
            font=("Microsoft YaHei UI", 24, "bold"),
        ).pack(anchor="w", padx=18, pady=(20, 2))
        tk.Label(
            self.panel,
            text="Python桌面小游戏",
            bg="#191b22",
            fg="#9aa3b8",
            font=("Microsoft YaHei UI", 10),
        ).pack(anchor="w", padx=20, pady=(0, 20))

        stats = tk.Frame(self.panel, bg="#191b22")
        stats.pack(fill="x", padx=14)
        self.stat_tile(stats, "分数", self.score_var, 0, 0)
        self.stat_tile(stats, "最高分", self.best_var, 0, 1)
        self.stat_tile(stats, "生命", self.lives_var, 1, 0)
        self.stat_tile(stats, "等级", self.level_var, 1, 1)

        tk.Button(
            self.panel,
            text="开始 / 重开",
            command=self.reset_game,
            bg="#20d6b4",
            fg="#061018",
            activebackground="#45d6ff",
            activeforeground="#061018",
            relief="flat",
            font=("Microsoft YaHei UI", 12, "bold"),
            height=2,
        ).pack(fill="x", padx=16, pady=(24, 10))
        tk.Button(
            self.panel,
            text="暂停 / 继续",
            command=self.toggle_pause,
            bg="#2a3040",
            fg="#f5f7fb",
            activebackground="#343d52",
            activeforeground="#f5f7fb",
            relief="flat",
            font=("Microsoft YaHei UI", 12, "bold"),
            height=2,
        ).pack(fill="x", padx=16)

        tk.Label(
            self.panel,
            textvariable=self.status_var,
            wraplength=215,
            justify="left",
            bg="#191b22",
            fg="#ffbf4d",
            font=("Microsoft YaHei UI", 10, "bold"),
        ).pack(anchor="w", padx=18, pady=(22, 12))

        help_text = "操作\nWASD / 方向键：移动\n鼠标：跟随移动\n空格：暂停\n\n目标\n收集蓝色能量核\n躲开红色陨石\n分数越高节奏越快"
        tk.Label(
            self.panel,
            text=help_text,
            justify="left",
            bg="#191b22",
            fg="#9aa3b8",
            font=("Microsoft YaHei UI", 10),
        ).pack(anchor="w", padx=18, pady=(10, 0))

    def stat_tile(self, parent, label, variable, row, column):
        tile = tk.Frame(parent, bg="#20242e", width=108, height=76)
        tile.grid(row=row, column=column, padx=5, pady=5)
        tile.grid_propagate(False)
        tk.Label(
            tile,
            text=label,
            bg="#20242e",
            fg="#9aa3b8",
            font=("Microsoft YaHei UI", 9),
        ).pack(anchor="w", padx=10, pady=(9, 0))
        tk.Label(
            tile,
            textvariable=variable,
            bg="#20242e",
            fg="#f5f7fb",
            font=("Microsoft YaHei UI", 20, "bold"),
        ).pack(anchor="w", padx=10, pady=(2, 0))

    def bind_events(self):
        self.root.bind("<KeyPress>", self.on_key_press)
        self.root.bind("<KeyRelease>", self.on_key_release)
        self.canvas.bind("<Motion>", self.on_mouse_move)
        self.canvas.bind("<Leave>", self.on_mouse_leave)
        self.canvas.bind("<Button-1>", lambda _event: self.reset_game() if not self.running else None)

    def load_save(self):
        try:
            data = json.loads(SAVE_FILE.read_text(encoding="utf-8"))
            self.best = int(data.get("best", 0))
        except (FileNotFoundError, ValueError, json.JSONDecodeError):
            self.best = 0
        self.best_var.set(str(self.best))

    def save(self):
        SAVE_FILE.write_text(json.dumps({"best": self.best}, ensure_ascii=False), encoding="utf-8")

    def reset_soft(self):
        self.running = False
        self.paused = False
        self.game_over = False
        self.keys = set()
        self.mouse = None
        self.score = 0.0
        self.lives = 3
        self.level = 1
        self.spawn_timer = 0.0
        self.core_timer = 0.0
        self.ship = {"x": WIDTH * 0.22, "y": HEIGHT * 0.5, "radius": 17, "safe": 0.0}
        self.meteors = []
        self.cores = []
        self.particles = []
        self.stars = [
            {
                "x": random.uniform(0, WIDTH),
                "y": random.uniform(0, HEIGHT),
                "r": random.uniform(0.7, 2.1),
                "speed": random.uniform(24, 96),
                "alpha": random.uniform(0.35, 0.92),
            }
            for _ in range(118)
        ]
        self.last_time = time.perf_counter()
        self.update_hud()

    def reset_game(self):
        self.reset_soft()
        self.running = True
        self.ship["safe"] = 1.2
        self.status_var.set("开局稳一点，能量核比硬刚陨石值钱")
        self.last_time = time.perf_counter()
        self.loop()

    def update_hud(self):
        self.score_var.set(str(int(self.score)))
        self.best_var.set(str(self.best))
        self.lives_var.set(str(self.lives))
        self.level_var.set(str(self.level))

    def spawn_meteor(self):
        radius = random.uniform(14, 34)
        self.meteors.append(
            {
                "x": WIDTH + radius,
                "y": random.uniform(radius + 14, HEIGHT - radius - 14),
                "radius": radius,
                "vx": -(random.uniform(155, 238) + self.level * 18),
                "vy": random.uniform(-42, 42),
                "spin": random.uniform(-2.2, 2.2),
                "angle": random.uniform(0, math.tau),
            }
        )

    def spawn_core(self):
        self.cores.append(
            {
                "x": WIDTH + 22,
                "y": random.uniform(42, HEIGHT - 42),
                "radius": 12,
                "vx": -(138 + self.level * 10),
                "pulse": random.uniform(0, math.tau),
            }
        )

    def add_burst(self, x, y, color, count):
        for _ in range(count):
            self.particles.append(
                {
                    "x": x,
                    "y": y,
                    "vx": random.uniform(-135, 135),
                    "vy": random.uniform(-135, 135),
                    "life": random.uniform(0.3, 0.75),
                    "max_life": 0.75,
                    "size": random.uniform(2, 5),
                    "color": color,
                }
            )

    def on_key_press(self, event):
        key = event.keysym.lower()
        if key == "space":
            self.toggle_pause()
            return
        self.keys.add(key)

    def on_key_release(self, event):
        self.keys.discard(event.keysym.lower())

    def on_mouse_move(self, event):
        if self.running:
            self.mouse = {"x": event.x, "y": event.y}

    def on_mouse_leave(self, _event):
        self.mouse = None

    def toggle_pause(self):
        if not self.running:
            return
        self.paused = not self.paused
        self.status_var.set("已暂停，空格继续" if self.paused else "继续穿梭")
        self.last_time = time.perf_counter()
        self.draw()
        if not self.paused:
            self.loop()

    def update_ship(self, dt):
        speed = 285 + self.level * 8
        dx = 0
        dy = 0
        if "left" in self.keys or "a" in self.keys:
            dx -= 1
        if "right" in self.keys or "d" in self.keys:
            dx += 1
        if "up" in self.keys or "w" in self.keys:
            dy -= 1
        if "down" in self.keys or "s" in self.keys:
            dy += 1

        if dx or dy:
            length = math.hypot(dx, dy)
            self.ship["x"] += dx / length * speed * dt
            self.ship["y"] += dy / length * speed * dt
            self.mouse = None
        elif self.mouse:
            blend = min(1, dt * 8)
            self.ship["x"] += (self.mouse["x"] - self.ship["x"]) * blend
            self.ship["y"] += (self.mouse["y"] - self.ship["y"]) * blend

        radius = self.ship["radius"]
        self.ship["x"] = clamp(self.ship["x"], radius + 6, WIDTH - radius - 6)
        self.ship["y"] = clamp(self.ship["y"], radius + 6, HEIGHT - radius - 6)
        self.ship["safe"] = max(0, self.ship["safe"] - dt)

    def update_world(self, dt):
        self.level = int(self.score // 250) + 1
        self.spawn_timer -= dt
        self.core_timer -= dt

        if self.spawn_timer <= 0:
            self.spawn_meteor()
            self.spawn_timer = max(0.28, 0.92 - self.level * 0.045)

        if self.core_timer <= 0:
            self.spawn_core()
            self.core_timer = random.uniform(0.75, 1.4)

        for star in self.stars:
            star["x"] -= star["speed"] * dt * (1 + self.level * 0.025)
            if star["x"] < -5:
                star["x"] = WIDTH + 5
                star["y"] = random.uniform(0, HEIGHT)

        for meteor in self.meteors:
            meteor["x"] += meteor["vx"] * dt
            meteor["y"] += meteor["vy"] * dt
            meteor["angle"] += meteor["spin"] * dt
            if meteor["y"] < meteor["radius"] or meteor["y"] > HEIGHT - meteor["radius"]:
                meteor["vy"] *= -1

        for core in self.cores:
            core["x"] += core["vx"] * dt
            core["pulse"] += dt * 6

        for particle in self.particles:
            particle["x"] += particle["vx"] * dt
            particle["y"] += particle["vy"] * dt
            particle["life"] -= dt

        self.meteors = [meteor for meteor in self.meteors if meteor["x"] > -meteor["radius"] * 2]
        self.cores = [core for core in self.cores if core["x"] > -40]
        self.particles = [particle for particle in self.particles if particle["life"] > 0]

    def resolve_collisions(self):
        for core in self.cores[:]:
            if distance(self.ship, core) < self.ship["radius"] + core["radius"] + 4:
                self.cores.remove(core)
                self.score += 50
                self.add_burst(core["x"], core["y"], "#45d6ff", 16)

        if self.ship["safe"] > 0:
            return

        for meteor in self.meteors[:]:
            if distance(self.ship, meteor) < self.ship["radius"] + meteor["radius"] - 4:
                self.meteors.remove(meteor)
                self.lives -= 1
                self.ship["safe"] = 1.15
                self.add_burst(self.ship["x"], self.ship["y"], "#ff5a68", 28)
                self.status_var.set("擦到了！别急，还有机会")
                if self.lives <= 0:
                    self.end_game()
                return

    def end_game(self):
        self.running = False
        self.game_over = True
        if int(self.score) > self.best:
            self.best = int(self.score)
            self.save()
            self.status_var.set("新纪录！这局适合录成开头钩子")
        else:
            self.status_var.set("结束了，再来一把冲新纪录")
        self.update_hud()
        self.draw_end_screen()

    def draw_background(self):
        self.canvas.delete("all")
        self.canvas.create_rectangle(0, 0, WIDTH, HEIGHT, fill="#080b12", outline="")
        self.canvas.create_oval(-140, -120, 300, 260, fill="#102b3b", outline="")
        self.canvas.create_oval(700, 340, 1120, 760, fill="#2e2330", outline="")
        for star in self.stars:
            shade = int(180 + star["alpha"] * 65)
            color = "#{0:02x}{0:02x}{0:02x}".format(shade)
            x = star["x"]
            y = star["y"]
            r = star["r"]
            self.canvas.create_oval(x - r, y - r, x + r, y + r, fill=color, outline="")

    def draw_ship(self):
        x = self.ship["x"]
        y = self.ship["y"]
        flicker = self.ship["safe"] > 0 and int(self.ship["safe"] * 12) % 2 == 0
        fill = "#2a889e" if flicker else "#45d6ff"
        self.canvas.create_polygon(
            x + 24,
            y,
            x - 16,
            y - 16,
            x - 8,
            y,
            x - 16,
            y + 16,
            fill=fill,
            outline="#d9fbff",
            width=2,
        )
        flame = random.uniform(0, 6)
        self.canvas.create_polygon(
            x - 16,
            y - 8,
            x - 31 - flame,
            y,
            x - 16,
            y + 8,
            fill="#ffbf4d",
            outline="",
        )

    def draw_meteor(self, meteor):
        points = []
        for i in range(10):
            angle = meteor["angle"] + math.tau * i / 10
            size = meteor["radius"] * (0.78 if i % 2 else 1.08)
            points.extend(
                [
                    meteor["x"] + math.cos(angle) * size,
                    meteor["y"] + math.sin(angle) * size,
                ]
            )
        self.canvas.create_polygon(points, fill="#8c3640", outline="#ff8791", width=2)

    def draw_core(self, core):
        glow = 5 + math.sin(core["pulse"]) * 3
        x = core["x"]
        y = core["y"]
        r = core["radius"]
        self.canvas.create_oval(
            x - r - glow,
            y - r - glow,
            x + r + glow,
            y + r + glow,
            fill="#123d4d",
            outline="",
        )
        self.canvas.create_oval(x - r, y - r, x + r, y + r, fill="#45d6ff", outline="")
        self.canvas.create_oval(x - 6, y - 6, x + 1, y + 1, fill="#f5fdff", outline="")

    def draw_particles(self):
        for particle in self.particles:
            alpha = max(0.15, particle["life"] / particle["max_life"])
            size = particle["size"] * alpha
            self.canvas.create_oval(
                particle["x"] - size,
                particle["y"] - size,
                particle["x"] + size,
                particle["y"] + size,
                fill=particle["color"],
                outline="",
            )

    def draw(self):
        self.draw_background()
        for core in self.cores:
            self.draw_core(core)
        for meteor in self.meteors:
            self.draw_meteor(meteor)
        self.draw_particles()
        self.draw_ship()
        if self.paused:
            self.canvas.create_rectangle(0, 0, WIDTH, HEIGHT, fill="#080b12", stipple="gray50", outline="")
            self.canvas.create_text(
                WIDTH / 2,
                HEIGHT / 2,
                text="已暂停",
                fill="#f5f7fb",
                font=("Microsoft YaHei UI", 44, "bold"),
            )

    def draw_start_screen(self):
        self.draw_background()
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 - 70,
            text="星尘穿梭",
            fill="#f5f7fb",
            font=("Microsoft YaHei UI", 62, "bold"),
        )
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 + 8,
            text="收集能量核，躲开陨石。点击画面或右侧按钮开始。",
            fill="#9aa3b8",
            font=("Microsoft YaHei UI", 16),
        )
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 + 64,
            text="适合录屏：节奏快、颜色亮、分数反馈清楚",
            fill="#ffbf4d",
            font=("Microsoft YaHei UI", 14, "bold"),
        )

    def draw_end_screen(self):
        self.draw()
        self.canvas.create_rectangle(0, 0, WIDTH, HEIGHT, fill="#080b12", stipple="gray50", outline="")
        title = "新纪录！" if int(self.score) >= self.best else "游戏结束"
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 - 62,
            text=title,
            fill="#f5f7fb",
            font=("Microsoft YaHei UI", 52, "bold"),
        )
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 + 4,
            text=f"本局得分：{int(self.score)}    最高分：{self.best}",
            fill="#45d6ff",
            font=("Microsoft YaHei UI", 19, "bold"),
        )
        self.canvas.create_text(
            WIDTH / 2,
            HEIGHT / 2 + 58,
            text="点击画面或按右侧按钮再来一局",
            fill="#9aa3b8",
            font=("Microsoft YaHei UI", 15),
        )

    def loop(self):
        if not self.running or self.paused:
            return
        now = time.perf_counter()
        dt = min(0.033, now - self.last_time)
        self.last_time = now

        self.update_ship(dt)
        self.update_world(dt)
        self.resolve_collisions()
        if self.running:
            self.score += 18 * dt
            self.update_hud()
            self.draw()
            self.root.after(16, self.loop)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    StarDash().run()
