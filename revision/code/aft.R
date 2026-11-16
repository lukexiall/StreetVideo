# Multilevel AFT analysis: GVI (RCS) -> observed segment duration
# usage: Rscript aft.R <csv> <outdir> <model_id|all>
suppressPackageStartupMessages({library(TMB); library(survival); library(Hmisc)})
dyn.load(dynlib("/tmp/claude-0/-home-user-StreetVideo/f0016cfd-d14f-56cb-bc44-6a108ec88dfa/scratchpad/aftme"))
fit_tmb <- function(f, d, dist, use_ses) {
  X <- model.matrix(f, d); y <- log(d$duration_s)
  st <- lm.fit(X, y)
  dl <- list(logt = y, event = as.numeric(d$departure_status), X = X,
             seg = as.integer(d$segment) - 1L, ses = as.integer(d$session) - 1L,
             dist = c(lognormal = 0L, weibull = 1L, loglogistic = 2L)[[dist]], use_ses = as.integer(use_ses))
  pa <- list(beta = unname(st$coefficients), log_sigma = log(sd(st$residuals)), log_sd_seg = log(.2), log_sd_ses = log(.1),
             b = numeric(nlevels(d$segment)), u = numeric(nlevels(d$session)))
  map <- if (use_ses) list() else list(log_sd_ses = factor(NA), u = factor(rep(NA, nlevels(d$session))))
  ob <- MakeADFun(dl, pa, random = if (use_ses) c("b", "u") else "b", map = map, DLL = "aftme", silent = TRUE)
  op <- nlminb(ob$par, ob$fn, ob$gr, control = list(eval.max = 2000, iter.max = 1000))
  sr <- sdreport(ob)
  pf <- sr$par.fixed; Vf <- sr$cov.fixed; ib <- which(names(pf) == "beta")
  cf <- pf[ib]; names(cf) <- colnames(X); V <- Vf[ib, ib]; dimnames(V) <- list(colnames(X), colnames(X))
  list(cf = cf, V = V, ll = -op$objective, conv = op$convergence, pdHess = sr$pdHess,
       sigma = exp(pf[["log_sigma"]]), sd_seg = exp(pf[["log_sd_seg"]]),
       sd_ses = if (use_ses) exp(pf[["log_sd_ses"]]) else NA,
       re_seg = setNames(sr$par.random[names(sr$par.random) == "b"], levels(d$segment)))
}
args <- commandArgs(TRUE); csv <- args[1]; od <- args[2]; which_m <- args[3]
d0 <- read.csv(csv)
d0$street  <- relevel(factor(d0$street), "Hindley")
d0$season  <- relevel(factor(d0$season), "spring")
d0$period  <- relevel(factor(d0$period), "morning")
d0$weekend <- as.integer(d0$day_type == "weekend")
d0$segment <- factor(d0$segment); d0$session <- factor(d0$session)
cont <- c(temp="air_temp_BoM_S4_C", FAR="FAR", fmix="functional_mix", HW="HW_ratio",
          foot="footpath_m", POI="POI_per100m", vol="pedestrian_volume_session")
# reporting increments on original scale
incr <- c(temp=5, FAR=1, fmix=0.1, HW=0.1, foot=1, POI=1, vol=10)
SD <- sapply(cont, function(v) sd(d0[[v]]))
for (k in names(cont)) d0[[paste0("z_", k)]] <- as.numeric(scale(d0[[cont[k]]]))

TEMP <- c("season", "period", "weekend", "z_temp")
BUILT <- c("z_FAR", "z_fmix", "z_HW", "z_foot", "seating", "outdoor_dining", "z_POI", "bus_stop", "crossing")
pct <- list(`3` = c(.10, .50, .90), `4` = c(.05, .35, .65, .95), `5` = c(.05, .275, .50, .725, .95))

fit_one <- function(id, dist = "lognormal", nk = 4, expo = "GVI_seasonal", adj = c(TEMP, BUILT),
                    drop_street = NULL, complete = FALSE, extra = NULL, re_session = TRUE) {
  d <- d0
  if (!is.null(drop_street)) d <- droplevels(d[d$street != drop_street, ])
  if (complete) d <- d[d$departure_status == 1, ]
  # knots from segment x season exposure distribution
  ss <- if (expo == "GSV_GVI_") unique(d[, c("segment", expo)]) else unique(d[, c("segment", "season", expo)])
  kn <- unname(quantile(ss[[expo]], pct[[as.character(nk)]], type = 7))
  B <- rcspline.eval(d[[expo]], knots = kn, inclx = TRUE)
  colnames(B) <- paste0("g", seq_len(ncol(B))); d <- cbind(d, B)
  rhs <- c(colnames(B), "street", adj, extra)
  if (length(unique(d$street)) < 2) rhs <- setdiff(rhs, "street")
  d$segment <- droplevels(d$segment); d$session <- droplevels(d$session)
  f <- as.formula(paste("~", paste(rhs, collapse = " + ")))
  t0 <- Sys.time()
  m <- fit_tmb(f, d, dist, re_session)
  cf <- m$cf; V <- m$V
  gi <- colnames(B)
  # spline contrast f(a) - f(b)
  basis <- function(x) { b <- rcspline.eval(x, knots = kn, inclx = TRUE); colnames(b) <- gi; b }
  lev <- c(5, 10, 15, 20, 25, 30)
  Bl <- basis(lev)
  con <- function(a, b) { L <- basis(a) - basis(b); est <- sum(L * cf[gi]); se <- sqrt(drop(L %*% V[gi, gi] %*% t(L))); c(est, se) }
  c2010 <- con(20, 10)
  w <- function(idx) { b <- cf[idx]; drop(t(b) %*% solve(V[idx, idx]) %*% b) }
  W_all <- w(gi); W_nl <- w(gi[-1])
  res <- data.frame(id = id, n = nrow(d), events = sum(d$departure_status),
    TR = exp(c2010[1]), lo = exp(c2010[1] - 1.96 * c2010[2]), hi = exp(c2010[1] + 1.96 * c2010[2]),
    W_all = W_all, df_all = length(gi), P_all = pchisq(W_all, length(gi), lower.tail = FALSE),
    W_nl = W_nl, df_nl = length(gi) - 1, P_nl = pchisq(W_nl, length(gi) - 1, lower.tail = FALSE),
    knots = paste(round(kn, 2), collapse = ";"), secs = as.numeric(difftime(Sys.time(), t0, units = "secs")),
    logLik = m$ll, conv = m$conv, pdHess = m$pdHess, sigma = m$sigma, sd_seg = m$sd_seg, sd_ses = m$sd_ses)
  write.csv(res, file.path(od, paste0("sum_", id, ".csv")), row.names = FALSE)
  # curve: TR relative to 10% over grid (for Fig S2)
  grid <- seq(min(ss[[expo]]), max(ss[[expo]]), length.out = 150)
  cur <- t(sapply(grid, function(x) con(x, 10)))
  write.csv(data.frame(gvi = grid, logtr = cur[, 1], se = cur[, 2]), file.path(od, paste0("curve_", id, ".csv")), row.names = FALSE)
  if (id == "primary") {
    # standardised predicted median: mean_i exp(eta_i) with GVI set to g, RE = 0
    X <- model.matrix(as.formula(paste("~", paste(rhs, collapse = "+"))), d)
    X <- X[, names(cf)[names(cf) %in% colnames(X)], drop = FALSE]
    cfx <- cf[colnames(X)]; Vx <- V[colnames(X), colnames(X)]
    medk <- if (dist == "lognormal") 1 else NA
    pred <- function(g) {
      Xg <- X; Xg[, gi] <- matrix(basis(g), nrow(X), length(gi), byrow = TRUE)
      e <- exp(drop(Xg %*% cfx)); m_ <- mean(e)
      grad <- colMeans(Xg * e) / m_          # gradient of log(mean)
      se <- sqrt(drop(t(grad) %*% Vx %*% grad)); c(m_, se)
    }
    P <- t(sapply(lev, pred))
    tab4 <- data.frame(GVI = lev, med = P[, 1], lo = P[, 1] * exp(-1.96 * P[, 2]), hi = P[, 1] * exp(1.96 * P[, 2]))
    vs5 <- t(sapply(lev, function(a) con(a, 5)))
    tab4$TR5 <- exp(vs5[, 1]); tab4$TR5lo <- exp(vs5[, 1] - 1.96 * vs5[, 2]); tab4$TR5hi <- exp(vs5[, 1] + 1.96 * vs5[, 2])
    tab4$P5 <- ifelse(lev == 5, NA, 2 * pnorm(-abs(vs5[, 1] / vs5[, 2])))
    write.csv(tab4, file.path(od, "table4.csv"), row.names = FALSE)
    gp <- seq(min(ss[[expo]]), max(ss[[expo]]), length.out = 150)
    PP <- t(sapply(gp, pred))
    write.csv(data.frame(gvi = gp, med = PP[, 1], lo = PP[, 1] * exp(-1.96 * PP[, 2]), hi = PP[, 1] * exp(1.96 * PP[, 2])),
              file.path(od, "fig6_curve.csv"), row.names = FALSE)
    # Table S1: covariate TRs on original-scale increments
    nm <- setdiff(names(cf), c("(Intercept)", gi))
    sc <- sapply(nm, function(n) { k <- sub("^z_", "", n); if (grepl("^z_", n)) incr[k] / SD[k] else 1 })
    est <- cf[nm] * sc; se <- sqrt(diag(V)[nm]) * sc
    s1 <- data.frame(term = nm, TR = exp(est), lo = exp(est - 1.96 * se), hi = exp(est + 1.96 * se), P = 2 * pnorm(-abs(est / se)))
    write.csv(s1, file.path(od, "tableS1.csv"), row.names = FALSE)
    write.csv(data.frame(segment = names(m$re_seg), re = m$re_seg), file.path(od, "ranef_segment.csv"), row.names = FALSE)
  }
  invisible(res)
}

specs <- list(
  primary   = list(),
  base      = list(adj = NULL),
  temporal  = list(adj = TEMP),
  built     = list(adj = BUILT),
  weibull   = list(dist = "weibull"),
  loglogis  = list(dist = "loglogistic"),
  k3        = list(nk = 3),
  k5        = list(nk = 5),
  gsv       = list(expo = "GSV_GVI_"),
  complete  = list(complete = TRUE),
  volume    = list(extra = "z_vol"),
  segonly   = list(re_session = FALSE),
  noHindley = list(drop_street = "Hindley"),
  noGouger  = list(drop_street = "Gouger"),
  noMelb    = list(drop_street = "Melbourne"),
  noHutt    = list(drop_street = "Hutt"))
ids <- if (which_m == "all") names(specs) else strsplit(which_m, ",")[[1]]
for (id in ids) { r <- do.call(fit_one, c(list(id = id), specs[[id]])); print(r[, c("id", "TR", "lo", "hi", "P_all", "P_nl", "secs")]) }
