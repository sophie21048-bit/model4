// ================================
// ПОИСК БОРДЮРОВ НА ФОТО
// Подключение модели Roboflow к сайту
// ================================

// ВАЖНО: вставьте сюда свои данные из Roboflow (инструкция в README).
const CURB_CONFIG = {
    // Идентификатор модели: скопируйте его на странице Models
    // (кнопка копирования рядом с Model URL), например: "workspace/curbs-qavhj-4-rfdetr..."
    MODEL_ID: "s-workspace-6oush/curbs-qavhj-4-rfdetr-small-t1",

    // Запасной вариант ID (необязательно). Если первый не подойдёт, сайт попробует этот.
    // Например, короткий вид "проект/номер версии": "curbs-qavhj/4"
    MODEL_ID_ALT: "curbs-qavhj/4",

    // Publishable Key из Roboflow: Settings -> API Keys
    API_KEY: "rf_A0B9nvbgXCeqfsLibxCZFsQ6MoZ2",

    // Адрес облачного API Roboflow (менять не нужно)
    ENDPOINT: "https://serverless.roboflow.com",

    // Максимальная ширина фото при отправке (px). Большие панорамы уменьшаются.
    MAX_WIDTH: 1600
};

(function () {
    const fileInput = document.getElementById("curbFile");
    const runButton = document.getElementById("curbRun");
    const thresholdInput = document.getElementById("curbThreshold");
    const thresholdValue = document.getElementById("curbThresholdValue");
    const statusEl = document.getElementById("curbStatus");
    const canvas = document.getElementById("curbCanvas");

    if (!fileInput || !canvas || !runButton) {
        return;
    }

    const ctx = canvas.getContext("2d");

    let currentImage = null;   // фото, которое отправляется в модель
    let predictions = [];      // ответ модели

    function setStatus(text, isError) {
        statusEl.textContent = text;
        statusEl.classList.toggle("is-error", Boolean(isError));
    }

    function isConfigured() {
        return (
            CURB_CONFIG.MODEL_ID &&
            CURB_CONFIG.API_KEY &&
            !CURB_CONFIG.MODEL_ID.startsWith("ВСТАВЬТЕ") &&
            !CURB_CONFIG.API_KEY.startsWith("ВСТАВЬТЕ")
        );
    }

    // Читаем файл, уменьшаем до MAX_WIDTH и рисуем на canvas
    function loadImage(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onerror = function () {
                reject(new Error("Не удалось прочитать файл."));
            };

            reader.onload = function () {
                const img = new Image();

                img.onerror = function () {
                    reject(new Error("Не удалось открыть изображение. Попробуйте JPG или PNG."));
                };

                img.onload = function () {
                    const scale = Math.min(1, CURB_CONFIG.MAX_WIDTH / img.width);
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);

                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);

                    resolve({ width: w, height: h });
                };

                img.src = reader.result;
            };

            reader.readAsDataURL(file);
        });
    }

    // Отправка изображения в модель
    async function detectWith(modelId) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const base64 = dataUrl.split(",")[1];

        const url =
            CURB_CONFIG.ENDPOINT + "/" + modelId +
            "?api_key=" + encodeURIComponent(CURB_CONFIG.API_KEY) +
            "&confidence=10";

        let response;

        try {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: base64
            });
        } catch (error) {
            console.error(error);
            const hint = location.protocol === "file:"
                ? " Сайт открыт как файл: откройте его по ссылке github.io."
                : " Отключите VPN и блокировщики рекламы и попробуйте снова.";

            throw new Error("Не удалось связаться с Roboflow." + hint + " Подробности: " + (error && error.message ? error.message : error));
        }

        if (!response.ok) {
            let details = "";
            try { details = await response.text(); } catch (e) {}
            console.error("Ответ Roboflow:", response.status, details);

            if (response.status === 401 || response.status === 403) {
                throw new Error("Roboflow не принял ключ (ошибка " + response.status + "). Проверьте API_KEY.");
            }

            if (response.status === 404) {
                throw new Error("Модель не найдена (ошибка 404). Проверьте MODEL_ID: он должен быть скопирован целиком.");
            }

            throw new Error("Модель вернула ошибку " + response.status + ".");
        }

        const data = await response.json();
        return data.predictions || [];
    }

    // Пробуем основной ID, затем запасной
    async function detect() {
        const ids = [CURB_CONFIG.MODEL_ID, CURB_CONFIG.MODEL_ID_ALT]
            .map(function (id) { return (id || "").trim(); })
            .filter(function (id) { return id && !id.startsWith("ВСТАВЬТЕ"); });

        let lastError = null;

        for (const id of ids) {
            try {
                const result = await detectWith(id);
                console.log("Модель ответила, рабочий ID:", id);
                return result;
            } catch (error) {
                console.warn("ID не подошёл:", id, error);
                lastError = error;
            }
        }

        throw lastError || new Error("Не указан ID модели.");
    }

    // Отрисовка рамок поверх фото
    function draw() {
        if (!currentImage) {
            return;
        }

        ctx.putImageData(currentImage, 0, 0);

        const threshold = Number(thresholdInput.value) / 100;
        const visible = predictions.filter(function (p) {
            return p.confidence >= threshold;
        });

        const lineWidth = Math.max(2, Math.round(canvas.width / 400));
        const fontSize = Math.max(12, Math.round(canvas.width / 70));

        ctx.lineWidth = lineWidth;
        ctx.font = "600 " + fontSize + "px Manrope, system-ui, sans-serif";
        ctx.textBaseline = "top";

        visible.forEach(function (p) {
            const x = p.x - p.width / 2;
            const y = p.y - p.height / 2;

            ctx.strokeStyle = "#82505f";
            ctx.strokeRect(x, y, p.width, p.height);

            const label = "бордюр " + Math.round(p.confidence * 100) + "%";
            const textWidth = ctx.measureText(label).width;
            const pad = 4;

            ctx.fillStyle = "#82505f";
            ctx.fillRect(x, y, textWidth + pad * 2, fontSize + pad * 2);

            ctx.fillStyle = "#ffffff";
            ctx.fillText(label, x + pad, y + pad);
        });

        if (visible.length === 0) {
            setStatus("Бордюры не найдены при пороге " + thresholdInput.value + "%. Попробуйте снизить порог.");
        } else {
            setStatus("Найдено бордюров: " + visible.length + ". Предварительная оценка черновой модели.");
        }
    }

    // Шаг 1: выбрали фото -> показываем его и кнопку «Найти бордюры»
    fileInput.addEventListener("change", async function () {
        const file = fileInput.files && fileInput.files[0];

        if (!file) {
            return;
        }

        try {
            setStatus("Загружаю фото...");
            const size = await loadImage(file);

            canvas.hidden = false;
            currentImage = ctx.getImageData(0, 0, size.width, size.height);
            predictions = [];
            runButton.hidden = false;

            if (!isConfigured()) {
                setStatus("Фото загружено, но в файле curb-model.js не указаны ID модели и ключ Roboflow.", true);
            } else {
                setStatus("Фото загружено. Нажмите «Найти бордюры».");
            }
        } catch (error) {
            console.error(error);
            setStatus(error.message || "Не удалось открыть фото.", true);
        }

        // Позволяет выбрать то же самое фото ещё раз
        fileInput.value = "";
    });

    // Шаг 2: кнопка «Найти бордюры» отправляет фото в модель
    runButton.addEventListener("click", async function () {
        if (!currentImage) {
            setStatus("Сначала выберите фото.", true);
            return;
        }

        if (!isConfigured()) {
            setStatus("В файле curb-model.js не указаны ID модели и ключ Roboflow.", true);
            return;
        }

        runButton.disabled = true;

        try {
            setStatus("Модель ищет бордюры...");
            predictions = await detect();
            draw();
        } catch (error) {
            console.error(error);
            setStatus(error.message || "Не удалось обработать фото.", true);
        } finally {
            runButton.disabled = false;
        }
    });

    thresholdInput.addEventListener("input", function () {
        thresholdValue.textContent = thresholdInput.value + "%";
        draw();
    });
})();
