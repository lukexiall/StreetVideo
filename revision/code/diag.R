suppressPackageStartupMessages({library(car); library(spdep); library(Hmisc)})
a <- commandArgs(TRUE); d <- read.csv(a[1]); od <- a[2]
d$street <- relevel(factor(d$street), "Hindley"); d$season <- relevel(factor(d$season), "spring"); d$period <- relevel(factor(d$period), "morning")
d$weekend <- as.integer(d$day_type == "weekend")
ss <- unique(d[, c("segment", "season", "GVI_seasonal")]); kn <- quantile(ss$GVI_seasonal, c(.05, .35, .65, .95))
d$GVI <- rcspline.eval(d$GVI_seasonal, knots = kn, inclx = TRUE)
m <- lm(log(duration_s) ~ GVI + street + season + period + weekend + air_temp_BoM_S4_C + FAR + functional_mix + HW_ratio + footpath_m + seating + outdoor_dining + POI_per100m + bus_stop + crossing, d)
v <- vif(m); v <- if (is.matrix(v)) data.frame(term = rownames(v), GVIF = v[, 1], Df = v[, 2], adj = v[, 3]) else data.frame(term = names(v), GVIF = v, Df = 1, adj = sqrt(v))
v$report <- ifelse(v$Df == 1, v$GVIF, v$adj^2)   # VIF for 1-df terms; squared adjusted GVIF (VIF-comparable) for multi-df
write.csv(v, file.path(od, "vif.csv"), row.names = FALSE); print(v)
r <- read.csv(file.path(od, "ranef_segment.csv"))
r$street <- gsub("[0-9]+", "", r$segment); r$num <- as.integer(gsub("\\D", "", r$segment)); r <- r[order(r$street, r$num), ]
nb <- lapply(seq_len(nrow(r)), function(i) { j <- which(r$street == r$street[i] & abs(r$num - r$num[i]) == 1); if (length(j)) as.integer(j) else 0L })
class(nb) <- "nb"; attr(nb, "region.id") <- r$segment
set.seed(2025); mi <- moran.mc(r$re, nb2listw(nb, style = "W", zero.policy = TRUE), nsim = 999, zero.policy = TRUE)
cat("Moran I", round(mi$statistic, 3), "P", round(mi$p.value, 3), "\n"); print(table(r$street))
