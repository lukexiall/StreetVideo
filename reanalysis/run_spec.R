## Run one model specification of the GVI-duration analysis (multilevel AFT, tramME).
## Usage: Rscript run_spec.R <data_dir> <out_dir> <spec>
suppressMessages({library(tramME); library(survival)})
args <- commandArgs(TRUE); dat_dir <- args[1]; out_dir <- args[2]; spec <- args[3]
d0 <- read.csv(file.path(dat_dir, "ped.csv"))
g0 <- read.csv(file.path(dat_dir, "gvi.csv"))

## ---- specification ----
dist <- "lognormal"; nk <- 4; expo <- "GVI_seasonal"; drop_street <- NULL
covset <- "Full"; extra <- NULL; complete_only <- FALSE
switch(spec,
  Base = covset <- "Base", Temporal = covset <- "Temporal", Built = covset <- "Built", Full = {},
  Weibull = dist <- "weibull", LogLogistic = dist <- "loglogistic",
  K3 = nk <- 3, K5 = nk <- 5,
  GSV = expo <- "GSV_GVI_",
  Complete = complete_only <- TRUE,
  Volume = extra <- "ped_volume_z",
  exHindley = drop_street <- "Hindley", exGouger = drop_street <- "Gouger",
  exMelbourne = drop_street <- "Melbourne", exHutt = drop_street <- "Hutt",
  stop("unknown spec"))

d <- d0; g <- g0
if (!is.null(drop_street)) { d <- d[d$street != drop_street, ]; g <- g[g$street != drop_street, ] }
if (complete_only) d <- d[d$departure_status == 1, ]
streets <- c("Hindley","Gouger","Hutt","Melbourne"); streets <- streets[streets %in% d$street]
d$street   <- factor(d$street, streets)
d$season   <- factor(d$season, c("spring","winter","summer"))       # Table S1: spring reference
d$period   <- factor(d$period, c("morning","noon","late_afternoon"))
d$day_type <- factor(d$day_type, c("weekday","weekend"))
d$segment  <- factor(d$segment); d$session <- factor(d$session)
d$x <- d[[expo]]

## knots: percentiles of the segment x season exposure distribution (Harrell default positions)
kq <- list(`3` = c(.10,.50,.90), `4` = c(.05,.35,.65,.95), `5` = c(.05,.275,.50,.725,.95))[[as.character(nk)]]
if (expo == "GVI_seasonal") ex_vals <- g$GVI_seasonal else {
  u <- unique(d[, c("segment","season","GSV_GVI_")]); ex_vals <- u$GSV_GVI_ }
knots <- unname(quantile(ex_vals, kq))
rcs_basis <- function(x, k = knots) {
  K <- length(k); nrm <- (k[K]-k[1])^2; p <- function(u) pmax(u,0)^3
  B <- sapply(1:(K-2), function(j)
    (p(x-k[j]) - p(x-k[K-1])*(k[K]-k[j])/(k[K]-k[K-1]) + p(x-k[K])*(k[K-1]-k[j])/(k[K]-k[K-1]))/nrm)
  B <- cbind(x, matrix(B, ncol = K-2)); colnames(B) <- paste0("gvi", 1:(K-1)); B
}
d <- cbind(d, rcs_basis(d$x)); spl <- paste0("gvi", 1:(nk-1))

zs <- c(air_temp_BoM_S4_C = 5, FAR = 1, functional_mix = 0.1, HW_ratio = 0.1, footpath_m = 1, POI_per100m = 1,
        pedestrian_volume_session = 1)
sds <- sapply(d[names(zs)], sd)
for (v in names(zs)) d[[paste0(v, "_z")]] <- (d[[v]] - mean(d[[v]])) / sds[v]
d$ped_volume_z <- d$pedestrian_volume_session_z

temp  <- c("season","period","day_type","air_temp_BoM_S4_C_z")
built <- c("FAR_z","functional_mix_z","HW_ratio_z","footpath_m_z","seating","outdoor_dining","POI_per100m_z","bus_stop","crossing")
cov <- switch(covset, Base = NULL, Temporal = temp, Built = built, Full = c(temp, built))
st <- if (length(streets) > 1) "street"
rhs <- paste(c(spl, st, cov, extra), collapse = " + ")
f <- as.formula(paste("Surv(duration_s, departure_status) ~", rhs, "+ (1|segment) + (1|session)"))

t0 <- Sys.time()
ip <- NULL
if (dist == "weibull") {        # warm start: GVI + street model first, then add covariates from 0
  fb <- as.formula(paste("Surv(duration_s, departure_status) ~", paste(c(spl, st), collapse = " + "), "+ (1|segment) + (1|session)"))
  mb <- SurvregME(fb, data = d, dist = dist); cat("warm-start base convergence", mb$opt$convergence, "\n")
  m0 <- SurvregME(f, data = d, dist = dist, nofit = TRUE)
  b0 <- setNames(rep(0, length(m0$param$beta)), names(m0$param$beta))
  b0[names(mb$param$beta)] <- mb$param$beta
  ip <- list(beta = b0, theta = mb$param$theta)
}
for (attempt in 1:6) {          # tramME restarts from perturbed values on failure; reseed until converged
  set.seed(20250 + attempt)
  m <- SurvregME(f, data = d, dist = dist, initpar = if (attempt == 1) ip else NULL)
  cat("attempt", attempt, "convergence", m$opt$convergence, "\n")
  if (m$opt$convergence == 0) break
}
cat(spec, ": fitted in", round(difftime(Sys.time(), t0, units = "mins"), 1), "min; convergence", m$opt$convergence, "\n")
if (m$opt$convergence != 0) stop("NOT CONVERGED")

cf <- coef(m, with_baseline = TRUE); V <- vcov(m, pargroup = "fixef")
stopifnot(identical(names(cf), rownames(V)))
th1 <- names(cf)[1]; th2 <- names(cf)[2]
## F(t|x) = G(th1 + th2*log t - x'b);  log median = (G^-1(0.5) - th1 + x'b)/th2
z50 <- switch(dist, lognormal = 0, loglogistic = 0, weibull = log(log(2)))

## Wald tests on spline terms
b <- cf[spl]; W <- drop(t(b) %*% solve(V[spl, spl]) %*% b)
nl <- spl[-1]; Wn <- drop(t(cf[nl]) %*% solve(V[nl, nl, drop = FALSE]) %*% cf[nl])
p_overall <- pchisq(W, length(spl), lower.tail = FALSE); p_nl <- pchisq(Wn, length(nl), lower.tail = FALSE)

## standardised median: set exposure to g for every record, keep other covariates, REs = 0, average medians
X  <- model.matrix(as.formula(paste("~", rhs)), d)[, -1, drop = FALSE]
Xr <- X[, setdiff(colnames(X), spl), drop = FALSE]
med <- function(par, gv) mean(exp((z50 - par[th1] + drop(rcs_basis(gv) %*% par[spl]) + drop(Xr %*% par[colnames(Xr)])) / par[th2]))
numgrad <- function(fn, par, h = 1e-5) sapply(seq_along(par), function(i) { e <- replace(0 * par, i, h); (fn(par + e) - fn(par - e)) / (2 * h) })
dm <- function(fn) { est <- fn(cf); gr <- numgrad(fn, cf); c(est = est, se = sqrt(drop(t(gr) %*% V %*% gr))) }

ref_tr <- dm(function(p) log(med(p, 20)) - log(med(p, 10)))
summ <- data.frame(spec = spec, dist = dist, n = nrow(d), knots = paste(round(knots, 2), collapse = ";"),
  TR20v10 = exp(ref_tr["est"]), lo = exp(ref_tr["est"] - 1.96 * ref_tr["se"]), hi = exp(ref_tr["est"] + 1.96 * ref_tr["se"]),
  p20v10 = 2 * pnorm(-abs(ref_tr["est"] / ref_tr["se"])),
  Wald = W, p_overall = p_overall, Wald_nl = Wn, p_nonlinear = p_nl, logLik = as.numeric(logLik(m)),
  sd_segment = sqrt(varcov(m)$segment[1]), sd_session = sqrt(varcov(m)$session[1]), sigma = 1 / cf[th2])
write.csv(summ, file.path(out_dir, paste0("summary_", spec, ".csv")), row.names = FALSE)
print(summ, row.names = FALSE)

## predictions at display levels (Table 4) -- main & adjustment-set models only
if (spec %in% c("Base","Temporal","Built","Full")) {
  tab <- do.call(rbind, lapply(c(5,10,15,20,25,30), function(gv) {
    a <- dm(function(p) log(med(p, gv))); r <- dm(function(p) log(med(p, gv)) - log(med(p, 5)))
    data.frame(spec = spec, GVI = gv, median = exp(a[1]), lo = exp(a[1] - 1.96 * a[2]), hi = exp(a[1] + 1.96 * a[2]),
      TR_vs5 = exp(r[1]), TR_lo = exp(r[1] - 1.96 * r[2]), TR_hi = exp(r[1] + 1.96 * r[2]),
      p_vs5 = if (gv == 5) NA else 2 * pnorm(-abs(r[1] / r[2])))
  }))
  write.csv(tab, file.path(out_dir, paste0("pred_", spec, ".csv")), row.names = FALSE)
  ## curve over the observed range (figures)
  grid <- seq(1.7, 38.7, by = 0.5)
  curve <- do.call(rbind, lapply(grid, function(gv) {
    a <- dm(function(p) log(med(p, gv))); r <- dm(function(p) log(med(p, gv)) - log(med(p, 10)))
    data.frame(spec = spec, GVI = gv, median = exp(a[1]), lo = exp(a[1] - 1.96 * a[2]), hi = exp(a[1] + 1.96 * a[2]),
      TR_vs10 = exp(r[1]), TR_lo = exp(r[1] - 1.96 * r[2]), TR_hi = exp(r[1] + 1.96 * r[2]))
  }))
  write.csv(curve, file.path(out_dir, paste0("curve_", spec, ".csv")), row.names = FALSE)
}

## covariate time ratios for original-scale increments (Table S1) -- Full model only
if (spec == "Full") {
  sh <- setdiff(names(cf), c(th1, th2, spl))
  out <- do.call(rbind, lapply(sh, function(p) {
    v <- sub("_z$", "", p); k <- if (v %in% names(zs)) zs[[v]] / sds[[v]] else 1
    r <- dm(function(par) k * par[p] / par[th2])
    data.frame(term = p, TR = exp(r[1]), lo = exp(r[1] - 1.96 * r[2]), hi = exp(r[1] + 1.96 * r[2]), p = 2 * pnorm(-abs(r[1] / r[2])))
  }))
  write.csv(out, file.path(out_dir, "covariate_TR_Full.csv"), row.names = FALSE)
  ## segment random effects for Moran's I
  re <- ranef(m)$segment; write.csv(data.frame(segment = rownames(re), re = re[, 1]), file.path(out_dir, "ranef_segment_Full.csv"), row.names = FALSE)
  ## GVIF (Fox & Monette 1992) for covariate terms, computed from the record-level design matrix
  terms_ <- c("gvi", "street", cov); Xc <- X
  R <- cor(Xc); asg <- sapply(colnames(Xc), function(cn) terms_[sapply(terms_, function(t) startsWith(cn, t))][1])
  gv <- sapply(terms_, function(t) { i <- asg == t; det(R[i, i, drop = FALSE]) * det(R[!i, !i, drop = FALSE]) / det(R) })
  df_ <- sapply(terms_, function(t) sum(asg == t))
  write.csv(data.frame(term = terms_, GVIF = gv, Df = df_, adjGVIF = gv^(1 / (2 * df_))), file.path(out_dir, "gvif_Full.csv"), row.names = FALSE)
}
