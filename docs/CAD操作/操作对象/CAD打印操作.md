## CAD打印操作
```csharp
/// <summary>
/// CAD打印操作（输出pdf，dwf等）
/// </summary>
public class CADPrinting
{
    /// <summary>设置打印信息
    /// 
    /// </summary>
    /// <param name="layoutId">布局ID</param>
    /// <param name="plotArea">该布局中的一个区域</param>
    /// <param name="plotDevice">打印设备名</param>
    /// <param name="plotCanonicalMeida">标准打印介质名</param>
    /// <param name="plotStyle">打印样式</param>
    /// <param name="isSinglePage">是否只打印单页</param>
    /// <returns></returns>
    private static PlotInfo SetPlotInfo(Layout lo, Extents2d plotArea,
                                      string plotDevice, string plotCanonicalMeida, string plotStyle, bool isSinglePage)
    {
        PlotInfo pi = new PlotInfo();
        pi.Layout = lo.Id;

        //获取当前布局的打印信息
        PlotSettings ps = new PlotSettings(lo.ModelType);//是否模型空间
        ps.CopyFrom(lo);

        //着色打印选项，设置按线框进行打印
        ps.ShadePlot = PlotSettingsShadePlotType.Wireframe;

        //获取当前打印设置校验器
        PlotSettingsValidator psv = PlotSettingsValidator.Current;

        #region 以下这些设置请不要改变顺序！！！
            //以下2句顺序不能换！
            psv.SetPlotWindowArea(ps, plotArea);//设置打印区域            
        psv.SetPlotType(ps, Autodesk.AutoCAD.DatabaseServices.PlotType.Window);//设置为窗口打印模式

        //设置布满图纸打印
        psv.SetUseStandardScale(ps, true);//需要?
        psv.SetStdScaleType(ps, StdScaleType.ScaleToFit);//布满图纸

        //设置居中打印
        psv.SetPlotCentered(ps, true);
        psv.RefreshLists(ps);//更新设备列表 才能设置打印样式
        //设置打印样式
        try
        {
            psv.SetCurrentStyleSheet(ps, plotStyle);//设置打印样式(笔宽等)(为什么有时会出错？PS:不能与原样式形同？！！！)
        }
        catch (Autodesk.AutoCAD.Runtime.Exception e)
        {
            // MessageBox.Show(string.Format("{0}\n当前打印样式:{1}\n设置打印样式:{2}", e.Message, ps.CurrentStyleSheet, plotStyle), "设置打印样式出错");
        }

        //配置打印机和打印介质
        psv.SetPlotConfigurationName(ps, plotDevice, plotCanonicalMeida);
        psv.RefreshLists(ps);

        //设置打印单位
        try
        {
            psv.SetPlotPaperUnits(ps, PlotPaperUnit.Millimeters);//(为什么有时会出错？)            
        }
        catch (Autodesk.AutoCAD.Runtime.Exception e)
        {
            string errmsg = string.Format("设置尺寸单位出错\n{0}\n当前尺寸单位:{1}\n设置单位:{2}", e.Message, ps.PlotPaperUnits, PlotPaperUnit.Millimeters);
            CAcadDb.ShowMessage(errmsg);
        }

        //设置旋转角度（打印到同一文档时必须设置为同一旋转角）
        if (isSinglePage)
        {
            //if (plotDevice.ToUpper().IndexOf("DWF") >= 0)
            //{
            //    psv.SetPlotRotation(ps, PlotRotation.Degrees000);
            //}
            //else
            {
                if ((plotArea.MaxPoint.X - plotArea.MinPoint.X) > (plotArea.MaxPoint.Y - plotArea.MinPoint.Y))
                {
                    if (ps.PlotPaperSize.X > ps.PlotPaperSize.Y)
                    {
                        psv.SetPlotRotation(ps, PlotRotation.Degrees000);
                    }
                    else
                    {
                        psv.SetPlotRotation(ps, PlotRotation.Degrees090);
                    }
                }
                else
                {
                    if (ps.PlotPaperSize.X > ps.PlotPaperSize.Y)
                    {
                        psv.SetPlotRotation(ps, PlotRotation.Degrees090);
                    }
                    else
                    {
                        psv.SetPlotRotation(ps, PlotRotation.Degrees000);
                    }
                }
            }
        }
        else
        {
            //多页打印必须设置为统一旋转角度（否则打印会出错，出错信息：eValidePlotInfo！特别注意！！！）
            psv.SetPlotRotation(ps, PlotRotation.Degrees000);
        }
        #endregion

            pi.OverrideSettings = ps;//将PlotSetting与PlotInfo关联

        PlotInfoValidator piv = new PlotInfoValidator();
        piv.MediaMatchingPolicy = MatchingPolicy.MatchEnabled;
        piv.Validate(pi);//激活打印设置

        ps.Dispose();

        return pi;
    }


    /// <summary>打印预览
    /// 
    /// </summary>
    /// <returns></returns>
    public static bool Preview(
        Dictionary<ObjectId, List<Extents2d>> plotAreaDict,
        string plotDevice,
        string plotCanonicalMeida,
        string plotStyle,
        string saveFileName,
        bool isPlotSingle//是否每页单独保存
    )
    {
        bool ret = false;

        if (plotAreaDict.Count == 0) return true;

        #region 准备打印区域列表 PlotList
            Dictionary<Extents2d, ObjectId> PlotList = new Dictionary<Extents2d, ObjectId>();
        foreach (KeyValuePair<ObjectId, List<Extents2d>> kv in plotAreaDict)
        {
            foreach (Extents2d plotArea in kv.Value)
            {
                PlotList.Add(plotArea, kv.Key);
            }
        }
        #endregion

            if (PlotFactory.ProcessPlotState == ProcessPlotState.NotPlotting)
            {
                int sheetNum = 0;
                bool isFinished = false;//预览是否结束
                bool isReadyForPlot = false;//是否准备好打印

                while (!isFinished)
                {
                    PreviewEngineFlags flags = PreviewEngineFlags.Plot;
                    if (sheetNum > 0)
                        flags |= PreviewEngineFlags.PreviousSheet;
                    if (sheetNum < PlotList.Count - 1)
                        flags |= PreviewEngineFlags.NextSheet;

                    using (PlotEngine pe = PlotFactory.CreatePreviewEngine((int)flags))
                    {
                        PreviewEndPlotStatus stat = MultiPlotOrPreview(
                            pe, true, PlotList, sheetNum, plotAreaDict.Count,
                            plotDevice, plotCanonicalMeida, plotStyle, saveFileName,null
                        );

                        if (stat == PreviewEndPlotStatus.Next)
                        {
                            sheetNum++;
                        }
                        else if (stat == PreviewEndPlotStatus.Previous)
                        {
                            sheetNum--;
                        }
                        else if (stat == PreviewEndPlotStatus.Normal ||
                     stat == PreviewEndPlotStatus.Cancel)
                        {
                            isFinished = true;
                        }
                        else if (stat == PreviewEndPlotStatus.Plot)
                        {
                            isFinished = true;
                            isReadyForPlot = true;

                            ret = true;//结束
                        }
                    }
                }

                // If the plot button was used to exit the preview...

                if (isReadyForPlot)
                {
                    if (!isPlotSingle)
                    {
                        using (PlotEngine pe = PlotFactory.CreatePublishEngine())
                        {
                            PreviewEndPlotStatus stat = MultiPlotOrPreview(
                                pe, false, PlotList, -1, plotAreaDict.Count,
                                plotDevice, plotCanonicalMeida, plotStyle, saveFileName,null
                            );

                            ret = stat == PreviewEndPlotStatus.Cancel ? false : true;
                        }
                    }
                    else
                    {
                        #region 每页打印成一个PDF文件
                            foreach (KeyValuePair<ObjectId, List<Extents2d>> kv in plotAreaDict)
                            {
                                int i = 1;
                                foreach (Extents2d plotArea in kv.Value)
                                {
                                    PlotSinglePage(
                                        kv.Key, plotArea, plotDevice, plotCanonicalMeida, plotStyle,
                                        string.Format("{0}-{1}({2})", saveFileName, "布局名称", i++));
                                }
                            }
                        #endregion
                        }
                }

                //恢复变量
                // mFun.m_SetSystemVar("BACKGROUNDPLOT", BackGroundPlotVar);
            }
        else
        {
            // mCommands.m_ed.WriteMessage("\n其他打印正在进行中！");
        }

        return ret;
    }

    /// <summary>打印
    /// 
    /// </summary>
    /// <param name="plotAreaDict"></param>
    /// <param name="plotDevice"></param>
    /// <param name="plotCanonicalMeida"></param>
    /// <param name="plotStyle"></param>
    /// <param name="saveFileName"></param>
    /// <returns></returns>
    public static bool Plot(
        Dictionary<ObjectId, List<Extents2d>> plotAreaDict,
        string plotDevice,
        string plotCanonicalMeida,
        string plotStyle,
        string saveFileName,
        Dictionary<Extents2d,string> dicmedia
    )
    {
        bool ret = true;

        if (plotAreaDict.Count == 0) return true;

        #region 准备打印区域列表 PlotList
            Dictionary<Extents2d, ObjectId> PlotList = new Dictionary<Extents2d, ObjectId>();
        foreach (KeyValuePair<ObjectId, List<Extents2d>> kv in plotAreaDict)
        {
            foreach (Extents2d plotArea in kv.Value)
            {
                PlotList.Add(plotArea, kv.Key);
            }
        }
        #endregion

            if (PlotFactory.ProcessPlotState == ProcessPlotState.NotPlotting)
            {
                using (PlotEngine pe = PlotFactory.CreatePublishEngine())
                {
                    PreviewEndPlotStatus stat = MultiPlotOrPreview(
                        pe, false, PlotList, -1, plotAreaDict.Count,
                        plotDevice, plotCanonicalMeida, plotStyle, saveFileName, dicmedia
                    );

                    ret = stat == PreviewEndPlotStatus.Cancel ? false : true;
                }

                // mFun.m_SetSystemVar("BACKGROUNDPLOT", BackGroundPlotVar);
            }
        else
        {
            // mCommands.m_ed.WriteMessage("\n其他打印正在进行中！");
        }

        return ret;
    }

    /// <summary>多页打印/预览函数
    /// 
    /// </summary>
    /// <param name="pe"></param>
    /// <param name="isPreview"></param>
    /// <param name="plotList"></param>
    /// <param name="sheetNumIfPreview"></param>
    /// <param name="layoutCount"></param>
    /// <param name="plotDevice"></param>
    /// <param name="plotCanonicalMeida"></param>
    /// <param name="plotStyle"></param>
    /// <param name="saveFileName"></param>
    /// <returns></returns>
    private static PreviewEndPlotStatus MultiPlotOrPreview(
        PlotEngine pe,
        bool isPreview,
        Dictionary<Extents2d, ObjectId> plotList,
        int sheetNumIfPreview,
        int layoutCount,//布局总数,都在一个布局=1
        string plotDevice,
        string plotCanonicalMeida,
        string plotStyle,
        string saveFileName,
        Dictionary<Extents2d,string> dicmedia

    )
    {
        PreviewEndPlotStatus ret = PreviewEndPlotStatus.Cancel;

        string DocName = CAcadDb.acDoc.Name;
        DocName = DocName.Substring(DocName.LastIndexOf("\\") + 1);
        DocName = DocName.Substring(0, DocName.LastIndexOf("."));

        #region 准备打印区域列表plotAreaList
            Dictionary<Extents2d, ObjectId> plotAreaList = new Dictionary<Extents2d, ObjectId>();
        if (isPreview && sheetNumIfPreview >= 0)
        {
            KeyValuePair<Extents2d, ObjectId> kv = plotList.ElementAt(sheetNumIfPreview);
            plotAreaList.Add(kv.Key, kv.Value);//预览只能一个区域 
        }
        else
        {
            plotAreaList = plotList;//打印全部区域
        }
        #endregion

            using (Autodesk.AutoCAD.ApplicationServices.Application.DocumentManager.MdiActiveDocument.LockDocument())
        {
            Extents2d errext=new Extents2d();
            try
            {
                using (PlotProgressDialog ppd = new PlotProgressDialog(isPreview, plotAreaList.Count, false))
                {
                    #region 设置进度条显示信息
                        ppd.set_PlotMsgString(PlotMessageIndex.DialogTitle, "转换进度");
                    ppd.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "本布局转换进度：__/__");
                    ppd.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "总转换进度: __/__");

                    ppd.LowerPlotProgressRange = 0;
                    ppd.UpperPlotProgressRange = plotAreaList.Count;

                    //显示进度条对话框
                    ppd.OnBeginPlot();
                    ppd.IsVisible = true;
                    #endregion

                        int pageNum = 0;//布局打印页计数
                    int layoutPageNum = 0;//当前布局总打印页数(区域数)
                    int sheetNum = 0;//所有打印页计数(打印总区域数)
                    ObjectId layoutId = ObjectId.Null;//当前布局Id

                    Layout lo = null;
                    foreach (KeyValuePair<Extents2d, ObjectId> kv in plotAreaList)
                    {
                        if (kv.Value != layoutId)
                        {
                            layoutId = kv.Value;

                            lo = CAcadEntity.OpenLayout(layoutId);// mFun.m_OpenEntity(layoutId) as Layout;
                            LayoutManager.Current.CurrentLayout = lo.LayoutName;//切换为当前布局,是否必须?!!

                            pageNum = 0;//重置布局页计数

                            layoutPageNum = plotAreaList.Count(a => a.Value == layoutId);

                            ppd.LowerSheetProgressRange = 0;
                            ppd.UpperSheetProgressRange = layoutPageNum;
                        }
                        if (dicmedia!=null && dicmedia.ContainsKey(kv.Key))
                        {
                            //plotCanonicalMeida = dicmedia[kv.Key];
                        }
                        errext = kv.Key;
                        pageNum++;//布局页计数+1
                        sheetNum++;//总打印区域计数+1                    

                        ppd.set_PlotMsgString(PlotMessageIndex.SheetName,string.Format("{0}-{1}", DocName, lo.LayoutName));//打印文件名-布局名

                        //设置打印配置参数
                        PlotInfo pi = SetPlotInfo(lo, kv.Key, plotDevice, plotCanonicalMeida, plotStyle, isPreview);

                        #region 启动打印
                            if (sheetNum == 1)
                            {
                                pe.BeginPlot(ppd, null);

                                pe.BeginDocument(
                                    pi,                                     //打印信息
                                    CAcadDb.acDoc.Name,                     //当前图纸名
                                    null,
                                    1,                                      //打印份数
                                    !isPreview,                             //是否打印至文件
                                    isPreview ? "" : saveFileName           //保存文件名
                                    );
                            }
                            #endregion

                            #region 开始打印
                            ppd.OnBeginSheet();

                            ppd.SheetProgressPos = pageNum;
                            ppd.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption,string.Format("本布局转换进度：{0}/{1}", pageNum, layoutPageNum));

                            ppd.PlotProgressPos = sheetNum;
                            ppd.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption,string.Format("总转换进度：{0}/{1}", sheetNum, plotAreaList.Count));

                            pe.BeginPage(
                                new PlotPageInfo(),
                                pi,                                 //打印信息
                                sheetNum == plotAreaList.Count,     //是否最后一页
                                null
                                );

                            pe.BeginGenerateGraphics(null);
                            pe.EndGenerateGraphics(null);

                            PreviewEndPlotInfo pepi = new PreviewEndPlotInfo();
                            pe.EndPage(pepi);//结束本页打印，返回预览状态
                            ret = pepi.Status;
                            #endregion
                        }

                        #region 结束打印
                        ppd.OnEndSheet();
                        pe.EndDocument(null);

                        ppd.OnEndPlot();
                        pe.EndPlot(null);
                        #endregion
                    }
                }
                catch (Autodesk.AutoCAD.Runtime.Exception e)
                {
                    string errmsg = string.Format("\n转换出错\n: {0}！。\n", e.Message);
                    CAcadDb.ShowMessage(errmsg);
                    CAcadDb.ShowMessage(errext.ToString());
                    ret = PreviewEndPlotStatus.Cancel;
                }
                finally
                {
                   
                }
            }

            return ret;
        }

        /// <summary>批量预览
        /// 
        /// </summary>
        /// <param name="pd"></param>
        /// <param name="pe"></param>
        /// <returns></returns>
        public static PreviewEndPlotStatus MultiPreview(PlotData pd, PlotEngine pe)
        {
            PreviewEndPlotStatus ret = PreviewEndPlotStatus.Cancel;

            string DocName = CAcadDb.acDoc.Name;
            DocName = DocName.Substring(DocName.LastIndexOf("\\") + 1);
            DocName = DocName.Substring(0, DocName.LastIndexOf("."));
            ObjectId layoutId = CAcadDb.GetModelSpaceId();//当前布局Id
            using (Autodesk.AutoCAD.ApplicationServices.Application.DocumentManager.MdiActiveDocument.LockDocument())
            {
                Layout lo = CAcadEntity.OpenLayout(layoutId);
                try
                {
                    using (PlotProgressDialog ppd = new PlotProgressDialog(true, 1, false))
                    {
                        #region 设置进度条显示信息
                        ppd.set_PlotMsgString(PlotMessageIndex.DialogTitle, "打印预览");
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "");
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "");

                        ppd.LowerPlotProgressRange = 0;
                        ppd.UpperPlotProgressRange = 1;

                        //显示进度条对话框
                        ppd.OnBeginPlot();
                        ppd.IsVisible = true;
                        #endregion

                        int pageNum = 0;//布局打印页计数
                        int layoutPageNum = 0;//当前布局总打印页数(区域数)
                        int sheetNum = 0;//所有打印页计数(打印总区域数)

                        //
                        LayoutManager.Current.CurrentLayout = lo.LayoutName;//切换为当前布局,是否必须?!!

                        pageNum = 0;//重置布局页计数

                        layoutPageNum = 1;

                        ppd.LowerSheetProgressRange = 0;
                        ppd.UpperSheetProgressRange = layoutPageNum;
                        //}

                        pageNum++;//布局页计数+1
                        sheetNum++;//总打印区域计数+1                    

                        ppd.set_PlotMsgString(PlotMessageIndex.SheetName, "");//打印文件名-布局名

                        //设置打印配置参数
                        PlotInfo pi = SetPlotInfo(lo, pd.ext, pd.Dev, pd.Media, pd.style, true);

                        #region 启动打印
                        if (sheetNum == 1)
                        {
                            pe.BeginPlot(ppd, null);

                            pe.BeginDocument(
                                pi,                                     //打印信息
                                CAcadDb.acDoc.Name,                     //当前图纸名
                                null,
                                1,                                      //打印份数
                                false,                             //是否打印至文件
                                ""           //保存文件名
                                );
                        }
                        #endregion

                        #region 开始打印
                        ppd.OnBeginSheet();

                        ppd.SheetProgressPos = pageNum;
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "");

                        ppd.PlotProgressPos = sheetNum;
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "");

                        pe.BeginPage(
                            new PlotPageInfo(),
                            pi,                                 //打印信息
                            sheetNum == 1,     //是否最后一页
                            null
                            );

                        pe.BeginGenerateGraphics(null);
                        pe.EndGenerateGraphics(null);

                        PreviewEndPlotInfo pepi = new PreviewEndPlotInfo();
                        pe.EndPage(pepi);//结束本页打印，返回预览状态
                        ret = pepi.Status;
                        #endregion


                        #region 结束打印
                        ppd.OnEndSheet();
                        pe.EndDocument(null);

                        ppd.OnEndPlot();
                        pe.EndPlot(null);
                        #endregion
                    }
                }
                catch (Autodesk.AutoCAD.Runtime.Exception e)
                {
                    ret = PreviewEndPlotStatus.Cancel;
                }
            }

            return ret;
        }



        /// <summary> 单页预览
        ///
        /// </summary>
        /// <param name="layoutId"></param>
        /// <param name="plotArea"></param>
        /// <param name="plotDevice"></param>
        /// <param name="plotCanonicalMeida"></param>
        /// <param name="plotStyle"></param>
        public static PreviewEndPlotStatus PreviewSinglePage(
            ObjectId layoutId,
            Extents2d plotArea,
            string plotDevice,
            string plotCanonicalMeida,
            string plotStyle
            )
        {
            PreviewEndPlotStatus ret = PreviewEndPlotStatus.Cancel;
            if (PlotFactory.ProcessPlotState != ProcessPlotState.NotPlotting)
            {
                // MessageBox.Show("当前不能预览，另一个打印任务正在进行中！");
                // return ret;
            }

            using (Autodesk.AutoCAD.ApplicationServices.Application.DocumentManager.MdiActiveDocument.LockDocument())
            {
                Layout lo = CAcadEntity.OpenLayout(layoutId);// mFun.m_OpenEntity(layoutId) as Layout;

                if (LayoutManager.Current.CurrentLayout != lo.LayoutName)
                {
                    LayoutManager.Current.CurrentLayout = lo.LayoutName;
                }

                using (PlotProgressDialog ppd = new PlotProgressDialog(true, 1, false))
                {
                    #region 设置进度条信息

                    #endregion

                    using (PlotEngine pe = PlotFactory.CreatePreviewEngine(0))
                    {
                        try
                        {
                            //设置打印配置参数
                            PlotInfo pi = SetPlotInfo(lo, plotArea, plotDevice, plotCanonicalMeida, plotStyle, true);
                            pe.BeginPlot(ppd, null);
                            pe.BeginDocument(pi, CAcadDb.acDoc.Name, null, 1, false, "");
                            pe.BeginPage(new PlotPageInfo(), pi, true, null);
                            pe.BeginGenerateGraphics(null);
                            pe.EndGenerateGraphics(null);
                            PreviewEndPlotInfo pepi = new PreviewEndPlotInfo();
                            pe.EndPage(pepi);//结束本页打印，返回预览状态
                            pe.EndDocument(null);
                            pe.EndPlot(null);
                            ret = pepi.Status;
                        }
                        catch (System.Exception ex)
                        {
                            ret = PreviewEndPlotStatus.Cancel;
                        }
                    }
                }
            }
            return ret;
        }


        /// <summary>单页打印
        /// 
        /// </summary>
        /// <param name="layoutId"></param>
        /// <param name="plotArea"></param>
        /// <param name="plotDevice"></param>
        /// <param name="plotCanonicalMeida"></param>
        /// <param name="plotStyle"></param>
        /// <param name="saveFilName"></param>
        public static void PlotSinglePage(
            ObjectId layoutId,
            Extents2d plotArea,
            string plotDevice,
            string plotCanonicalMeida,
            string plotStyle,
            string saveFilName,
            bool showProgress = true
            )
        {
            if (PlotFactory.ProcessPlotState != ProcessPlotState.NotPlotting)
            {
                CAcadDb.ShowMessage("当前不能打印，另一个打印任务正在进行中！");
                return;
            }

            using (Autodesk.AutoCAD.ApplicationServices.Application.DocumentManager.MdiActiveDocument.LockDocument())
            {
                Layout lo = CAcadEntity.OpenLayout(layoutId);// mFun.m_OpenEntity(layoutId) as Layout;

                if (LayoutManager.Current.CurrentLayout != lo.LayoutName)
                {
                    LayoutManager.Current.CurrentLayout = lo.LayoutName;
                }
                Point3d ptTarget = (Point3d)CAcadDb.m_GetSystemVar("TARGET");//有的打印没东西就是这个的锅
                plotArea = new Extents2d(
                         plotArea.MinPoint.X - ptTarget.X, plotArea.MinPoint.Y - ptTarget.Y,
                    plotArea.MaxPoint.X - ptTarget.X, plotArea.MaxPoint.Y - ptTarget.Y);

                using (PlotProgressDialog ppd = new PlotProgressDialog(false, 1, false))
                {
                    #region 设置进度条信息
                    if (showProgress)
                    {
                        ppd.set_PlotMsgString(PlotMessageIndex.DialogTitle, "打印");
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "");
                        ppd.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "");
                        ppd.set_PlotMsgString(PlotMessageIndex.CancelJobButtonMessage, "取消打印");
                        ppd.set_PlotMsgString(PlotMessageIndex.CancelSheetButtonMessage, "取消打印页");

                        ppd.LowerPlotProgressRange = 0;
                        ppd.UpperPlotProgressRange = 1;

                        //显示进度条对话框
                        ppd.OnBeginPlot();
                        ppd.IsVisible = showProgress;
                    }
                    #endregion
                    using (PlotEngine pe = PlotFactory.CreatePublishEngine())
                    {
                        //设置打印配置参数
                        PlotInfo pi = SetPlotInfo(lo, plotArea, plotDevice, plotCanonicalMeida, plotStyle, true);

                        pe.BeginPlot(ppd, null);
                        pe.BeginDocument(pi, CAcadDb.acDoc.Name, null, 1, true, saveFilName);
                        pe.BeginPage(new PlotPageInfo(), pi, true, null);
                        pe.BeginGenerateGraphics(null);
                        pe.EndGenerateGraphics(null);
                        pe.EndPage(null);
                        pe.EndDocument(null);
                        pe.EndPlot(null);
                    }
                }
            }
        }
        //

    }

    public struct PlotData
    {
        public Extents2d ext;//图框范围
        public string Media;//图纸尺寸(ios A0(111X222)) AcDbPlotSettingsValidator::canonicalMediaNameList   AcDbPlotSettingsValidator::getLocaleMediaName
        public string Dev;//打印设备 输出PDF.pc3
        public static string ex = ".pdf";//文件扩展名，貌似可以忽略,打印设备自带默认扩展名
        public string style;//打印样式 acad.ctb
        public int rot;//角度(0自动,1横向,2纵向)
        public bool bRev;//是否反向
        public static double blkAng = 0;//块参照角度

        public Vector3d ptYZmax;//印章相对右下角的偏移
        public Vector3d ptYZmin;//印章相对右下角的偏移

        public string tkName;//图纸名称
        public string tkRemark;//图纸说明
        public string tkId;//图框Id;
        public string barCode;//条形码
        public string savepath;//pdf保存文件名
    }


    public struct MyPmpValue
    {
        public int id;
        public string caps_type;//
        public string name;//
        public string localized_name;//
        public string media_description_name;//
        public string media_group;//
        public bool landscape_mode;//
        public double media_bounds_urx;//长
        public double media_bounds_ury;//宽

        /*
    caps_type=2
    name="UserDefinedMetric (851.00 x 1497.00毫米)
    localized_name="A0+0.25
    media_description_name="UserDefinedMetric 纵向 851.00W x 1497.00H - (0, 0) x (851, 1497)
    media_group=15
    landscape_mode=FALSE
         */
        /*
    caps_type=2
    name="UserDefinedMetric 纵向 851.00W x 1497.00H - (0, 0) x (851, 1497)
    media_bounds_urx=851.0
    media_bounds_ury=1497.0
    printable_bounds_llx=5.0
    printable_bounds_lly=5.0
    printable_bounds_urx=846.0
    printable_bounds_ury=1492.0
    printable_area=1250567.0
    dimensional=TRUE
         */
    }

    public struct MyAllTK
    {
        public Extents2d ex2d;//范围
        public ObjectId id;//对象id
        public ObjectId loid;//布局id《模型空间，布局空间》
        public string loname;//布局的名字  模型/布局1/....
        public double scale;//缩放比例 100

        /// <summary>规则id(1:块名;2:图层名;3:自定义位置)
        /// 
        /// </summary>
        public int ruletype;

        /// <summary>图名(图纸名称)
        /// 
        /// </summary>
        public string prname;


        /// <summary>图号
        /// 
        /// </summary>
        public string th;


        public string xmmc;//项目名称

        public string zxmc;//子项名称

        public string tm;//图名

        public string tb;//图别

        public bool isrotate;//是否需要翻转

    }

    public struct EntityLayout
    {
        public ObjectId entid;
        public ObjectId loid;
        public string loname;
    }

    /// <summary>
    /// 打印相关公共方法
    /// </summary>
    public class PlotPublicFun
    {
        private static Dictionary<int, MyPmpValue> dicpmp;//

        //获取当前的打印样式
        public static string GetPlotStylesDir()
        {
            string poltstylepath = "";
            string gcpath = ArxDbData.globvalue.instance().GcPath;
            string cadver = gcpath.Substring(gcpath.LastIndexOf("\\") + 4);
            List<MyAllCAD> mycads = RegistryCAD.GetMyCADInfo();
            for (int i = 0; i < mycads.Count; i++)
            {
                MyAllCAD mycad = mycads[i];
                int y = mycad.cadyear;
                if (y.ToString() == cadver)
                {
                    try
                    {

                        RegistryKey rootkey = Registry.CurrentUser;
                        string strreg = mycad.cadreg.ToString().Replace("HKEY_LOCAL_MACHINE\\", "");
                        RegistryKey curky = rootkey.OpenSubKey(strreg, false);
                        RegistryKey profiles = curky.OpenSubKey("Profiles", false);
                        string[] ps = profiles.GetSubKeyNames();
                        for (int j = 0; j < ps.Length; j++)
                        {
                            RegistryKey rkgen = profiles.OpenSubKey(ps[j] + "\\General", false);
                            if (rkgen == null)
                            {
                                continue;
                            }
                            poltstylepath = rkgen.GetValue("PrinterStyleSheetDir").ToString();
                            if (poltstylepath != "")
                            {
                                break;
                            }
                        }
                    }
                    catch (System.Exception ex)
                    {

                    }
                    //RegistryKey gen = curky.OpenSubKey("Profiles\\<<未命名配置>>\\General", false);
                    if (poltstylepath != "")
                    {
                        break;
                    }
                }
            }
            return poltstylepath;
        }

        public static Dictionary<Extents2d, MyAllTK> GetAllTF(string tfconfigpath, bool getloid)
        {
            //1:读取识别规则
            System.Data.DataTable dt = XmlOpreate.ReadTKData2DT(tfconfigpath);
            //依次根据规则找图框(找到的记住对象,避免不同规则找到同一个)
            Dictionary<Extents2d, MyAllTK> dic = new Dictionary<Extents2d, MyAllTK>();//打印的范围-找到的图框
            foreach (DataRow dr in dt.Rows)
            {
                string ruletype = dr["RuleType"].ToString();//
                string tkname = dr["TKName"].ToString();//根据ruletype的值意义不同,1:块名;2:图层名;3:自定义位置
                string tksize = dr["TKSize"].ToString();//图纸尺寸
                string barcode = dr["BarCode"].ToString();//条形码位置
                string dwgdir = dr["DWGDirection"].ToString();//图纸方向
                string reverse = dr["Reverse"].ToString();//是否反向
                if (ruletype == "1")//块名
                {
                    string brname = tkname;
                    //获取名称为  的所有块
                    GetBrByName(brname, getloid, ref dic);
                }
                else if (ruletype == "2")//图层名
                {
                    string layname = tkname;
                    //获取  图层的多段线(矩形的(闭合的or有五个点的非闭合))
                    GetPLByLayer(layname, getloid, ref dic);
                    GetBrByLayer(layname, getloid, ref dic);
                }
                else if (ruletype == "3")//自定义位置
                {
                    string plsize = tkname;
                    //获取 坐标范围内的对象
                }
            }
            return dic;
        }

        //获取名称""的所有块对象
        private static void GetBrByName(string brname,bool getloid, ref Dictionary<Extents2d, MyAllTK> dic)
        {
            TypedValue[] acTypValAr = new TypedValue[3];
            acTypValAr.SetValue(new TypedValue((int)DxfCode.Operator, "<or"), 0);
            acTypValAr.SetValue(new TypedValue((int)DxfCode.BlockName, brname), 1);
            acTypValAr.SetValue(new TypedValue((int)DxfCode.Operator, "or>"), 2);
            SelectionFilter acSelFtr = new SelectionFilter(acTypValAr);
            ObjectIdCollection ids = CAcadGet.getDbObjCollection(CAcadDb.acDoc, acSelFtr);
            GetTKinfoByIds(1, ids, getloid, ref dic);
        }
        //获取图层内的多段线对象
        private static void GetPLByLayer(string layername,bool getloid, ref Dictionary<Extents2d, MyAllTK> dic)
        {
            Dictionary<ObjectId, EntityLayout> dicentlo = new Dictionary<ObjectId, EntityLayout>();//对象-空间id
            TypedValue[] acTypValAr = new TypedValue[2];
            acTypValAr.SetValue(new TypedValue((int)DxfCode.LayerName, layername), 0);
            acTypValAr.SetValue(new TypedValue((int)DxfCode.Start, "LWPOLYLINE"), 1);
            SelectionFilter acSelFtr = new SelectionFilter(acTypValAr);
            ObjectIdCollection ids = CAcadGet.getDbObjCollection(CAcadDb.acDoc, acSelFtr);
            using (Transaction trans = CAcadDb.CurrentDB.TransactionManager.StartTransaction())
            {
                if (getloid)
                {
                    dicentlo = GetIDLayoutId(ids);
                }
                foreach (ObjectId id in ids)
                {
                    ObjectId loid = ObjectId.Null;
                    string loname = "模型";
                    if (dicentlo.ContainsKey(id))
                    {
                        loid = dicentlo[id].loid;
                        loname = dicentlo[id].loname;
                    }
                    if (loid==ObjectId.Null)
                    {
                        continue;
                    }
                    Entity ent = ent = (Entity)trans.GetObject(id, OpenMode.ForRead);
                    //ent.PaperOrientation
                    if (ent is Polyline)
                    {
                        Polyline pl = ent as Polyline;
                        if (pl.Area < 0.1)//面积为0的不要
                        {
                            continue;
                        }
                        //
                        int numps = pl.NumberOfVertices;
                        if (numps < 4)
                        {
                            continue;
                        }
                        //必须算矩形的
                        string prname = ""; string th = ""; double scale = 1;
                        Extents3d e3d = ent.GeometricExtents;
                        Point2d pmin = new Point2d(e3d.MinPoint.X, e3d.MinPoint.Y);
                        Point2d pmax = new Point2d(e3d.MaxPoint.X, e3d.MaxPoint.Y);
                        Extents2d ex2d = new Extents2d(pmin, pmax);
                        double w = ex2d.MaxPoint.X - ex2d.MinPoint.X;
                        double h = ex2d.MaxPoint.Y - ex2d.MinPoint.Y;
                        double mj = w * h - pl.Area;
                        if (Math.Abs(mj) > 10)
                        {
                            continue;
                        }
                        if (!dic.ContainsKey(ex2d))
                        {
                            MyAllTK mytk = new MyAllTK();
                            mytk.loid = loid;
                            mytk.loname = loname;
                            mytk.ex2d = ex2d;
                            mytk.id = id;
                            mytk.ruletype = 2;
                            mytk.prname = "";
                            mytk.th = "";
                            mytk.scale = scale;
                            dic.Add(ex2d, mytk);
                        }
                    }
                    ent.Dispose();
                }
                trans.Commit();
            }

        }
        //获取图层内的图框对象(块)
        private static void GetBrByLayer(string layername, bool getloid, ref Dictionary<Extents2d, MyAllTK> dic)
        {
            TypedValue[] acTypValAr = new TypedValue[2];
            acTypValAr.SetValue(new TypedValue((int)DxfCode.LayerName, layername), 0);
            acTypValAr.SetValue(new TypedValue((int)DxfCode.Start, "INSERT"), 1);
            SelectionFilter acSelFtr = new SelectionFilter(acTypValAr);
            ObjectIdCollection ids = CAcadGet.getDbObjCollection(CAcadDb.acDoc, acSelFtr);
            GetTKinfoByIds(1, ids, getloid, ref dic);
        }
        private static void GetTKinfoByIds(int ruletp, ObjectIdCollection ids, bool getloid, ref Dictionary<Extents2d, MyAllTK> dic)
        {
            Dictionary<ObjectId, EntityLayout> dicentlo = new Dictionary<ObjectId, EntityLayout>();
            if (getloid)
            {
                dicentlo = GetIDLayoutId(ids);
            }
            foreach (ObjectId id in ids)
            {
                Dictionary<string, string> dicattr = new Dictionary<string, string>();
                MyAllTK mytk = new MyAllTK();
                if (dicentlo.ContainsKey(id))
                {
                    mytk.loid = dicentlo[id].loid;
                    mytk.loname = dicentlo[id].loname;
                }
                //
                double scale = 1;
                Extents2d ex2d = GetExtById(id, ref scale, ref dicattr);
                mytk.ex2d = ex2d;
                mytk.scale = scale;//缩放比例
                mytk.id = id;
                mytk.ruletype = ruletp;
               
                mytk.prname = GetDicValByKey(dicattr, "图纸名称");//
                mytk.xmmc = GetDicValByKey(dicattr, "项目名称");//
                mytk.zxmc = GetDicValByKey(dicattr, "子项名称");//
                mytk.tb = GetDicValByKey(dicattr, "图别");//
                mytk.tm = GetDicValByKey(dicattr, "图纸名称");//
                mytk.th = GetDicValByKey(dicattr, "图号");//
                if (!dic.ContainsKey(ex2d))
                {
                    dic.Add(ex2d, mytk);
                }
            }
        }
        //找每一个对象所在的布局空间id
        private static Dictionary<ObjectId, EntityLayout> GetIDLayoutId(ObjectIdCollection ids)
        {
            Dictionary<ObjectId, EntityLayout> dicentlo = new Dictionary<ObjectId, EntityLayout>();//对象-空间id
            if (ids==null || ids.Count==0)
            {
                return dicentlo;
            }
            using (Transaction trans = CAcadDb.CurrentDB.TransactionManager.StartTransaction())
            {
                //先找到Layout空间
                DBDictionary dict = (DBDictionary)trans.GetObject(CAcadDb.CurrentDB.LayoutDictionaryId,
                    OpenMode.ForRead);//得到所有空间，包括模型及布局
                foreach (var item in dict)
                {
                    ObjectId lyid = item.Value;// dict.GetAt(LayoutName);
                    Layout ly = (Layout)trans.GetObject(lyid, OpenMode.ForRead);
                    BlockTableRecord btr = (BlockTableRecord)trans.GetObject(ly.BlockTableRecordId, OpenMode.ForRead);

                    foreach (ObjectId oid in btr)
                    {
                        if (ids.Contains(oid))
                        {
                            EntityLayout el = new EntityLayout();
                            el.entid = oid;
                            el.loid = lyid;
                            el.loname = ly.LayoutName;
                            dicentlo.Add(oid, el);
                        }
                    }
                    if (dicentlo.Count == ids.Count)
                    {
                        break;
                    }
                }
            }
            return dicentlo;
        }
        //获取对象的范围/属性
        private static Extents2d GetExtById(ObjectId id, ref double scale, ref Dictionary<string, string> dicattr)
        {
            Extents2d ex2d = new Extents2d(0, 0, 0, 0);
            dicattr = new Dictionary<string, string>();//属性定义的值
            using (Transaction trans = CAcadDb.CurrentDB.TransactionManager.StartTransaction())
            {
                Entity ent = ent = (Entity)trans.GetObject(id, OpenMode.ForRead);
                if (ent != null)
                {
                    if (ent is BlockReference)
                    {
                        BlockReference bref = ent as BlockReference;
                        scale = bref.ScaleFactors.X;
                        foreach (ObjectId adid in bref.AttributeCollection)
                        {
                            AttributeReference ad = trans.GetObject(adid, OpenMode.ForRead) as AttributeReference;
                            string strtag = ad.Tag;
                            string strtxt = ad.TextString;
                            if (!dicattr.ContainsKey(strtag))
                            {
                                dicattr.Add(strtag, strtxt);
                            }
                        }
                    }
                    Extents3d e3d = ent.GeometricExtents;
                    Point2d pmin = new Point2d(e3d.MinPoint.X, e3d.MinPoint.Y);
                    Point2d pmax = new Point2d(e3d.MaxPoint.X, e3d.MaxPoint.Y);
                    ex2d = new Extents2d(pmin, pmax);
                }
                ent.Dispose();
                trans.Commit();
            }
            return ex2d;
        }
        //根据键返回值,没有就空字符串
        private static string GetDicValByKey(Dictionary<string, string> dic, string strkey)
        {
            if (dic.ContainsKey(strkey))
            {
                return dic[strkey];
            }
            return "";
        }

        public static Dictionary<Extents2d, MyAllTK> AddUserTk()
        {
            Dictionary<Extents2d, MyAllTK> dic = new Dictionary<Extents2d, MyAllTK>();//打印的范围-找到的图框
            TypedValue[] acTypValAr = new TypedValue[2];
            acTypValAr.SetValue(new TypedValue((int)DxfCode.LayerName, "TK"), 0);
            acTypValAr.SetValue(new TypedValue((int)DxfCode.Start, "INSERT"), 1);
            SelectionFilter acSelFtr = new SelectionFilter(acTypValAr);
            ObjectIdCollection brids = CAcadGet.getDbObjCollectionBySelection(CAcadDb.acDoc, acSelFtr, "选择需要打印的图签的范围");
            if (brids == null || brids.Count == 0)
            {
                return dic;
            }
           
            PlotPublicFun.GetTKinfoByIds(1, brids,false, ref dic);
            return dic;
        }


        #region 获取pc3文件的打印图纸尺寸

        /// <summary>解压pc3和pmp打印机文件
        /// //读取pc3文件的信息(实际是读取对应的pmp文件)
        /// </summary>
        /// <param name="pc3OrPmpPath">打印机路径</param>
        public static void Pc3PmpDecompress(string pc3OrPmpPath)
        {
            dicpmp = new Dictionary<int, MyPmpValue>();
            using (FileStream fs = File.Open(pc3OrPmpPath, FileMode.Open, FileAccess.ReadWrite))
            {
                //版本信息
                int ver1 = 48;
                {
                    byte[] buffer = new byte[ver1];
                    fs.Read(buffer, 0, ver1);
                    string str = Encoding.Default.GetString(buffer);
                    // Console.Write(Environment.NewLine + "版本信息:" + Environment.NewLine + str);
                }

                //12字节=3个int，第一个记录 "校验和" "adler"方式
                int ver2 = 4;
                {
                    //"校验和"读取
                    byte[] checkSum = new byte[ver2];
                    fs.Read(checkSum, 0, ver2);

                    //转为16进制再读
                    var ss = new List<string>();
                    for (int index = 0; index < checkSum.Length; index++)
                    {
                        var shiliu = ((int)checkSum[index]).ToString("X2");
                        ss.Add(shiliu);
                    }
                    // Console.Write(Environment.NewLine + "压缩校验和:" + Environment.NewLine + string.Join(" ", ss.ToArray()));
                }
                int ver3 = 8;
                {
                    //第二个是原始数据的字节数
                    //第三个是压缩后的字节数
                    BinaryReader br = new BinaryReader(fs);
                    var ss = new int[2];
                    for (int i = 0; i < 2; i++)
                    {
                        ss[i] = br.ReadInt32();
                    }
                    // Console.Write(Environment.NewLine + "压缩前的字节数:" + Environment.NewLine + ss[0].ToString());
                    // Console.Write(Environment.NewLine + "压缩后的字节数:" + Environment.NewLine + ss[1].ToString());
                }

                int ver4 = ver1 + ver2 + ver3; //前面头信息不能解压
                fs.Seek(ver4, SeekOrigin.Begin);//从新设置开始的位置,但是不设置也会自动读到这里
                //2:
                using (ZlibStream zs = new ZlibStream(fs, CompressionMode.Decompress))//zip流,解压
                {
                    using (StreamReader sr = new StreamReader(zs, Encoding.Default))//流读取器 乱码原因
                    {
                        string str = sr.ReadToEnd(); //读到结束  
                        dicpmp = GetPmpval(str);
                    }
                    zs.Dispose();
                }
                fs.Dispose();
            }
        }

        private static Dictionary<int, MyPmpValue> GetPmpval(string str)
        {
            Dictionary<int, MyPmpValue> dicpc3 = new Dictionary<int, MyPmpValue>();//pc3的数据
            try
            {
                string udmstr = str.Substring(str.IndexOf("udm{"));
                int ipos_des = udmstr.IndexOf("description{");
                int ipos_size = udmstr.IndexOf("size{");
                int ipos_hid = udmstr.IndexOf("hidden{");
                string sizestr = udmstr.Substring(ipos_size + 5, ipos_des - ipos_size - 5);
                string desstr = udmstr.Substring(ipos_des + 12, ipos_hid - ipos_des - 12);
                string hidstr = udmstr.Substring(ipos_hid);
                //size:
                dicpc3 = GetSizes(sizestr);
                GetDes(desstr, ref dicpc3);
                //Dictionary<int,MyPmpValue> lst_hid = GetSizes(hidstr);
            }
            catch (System.Exception ex)
            {

            }
            return dicpc3;
        }

        private static Dictionary<int, MyPmpValue> GetSizes(string sizestr)
        {
            Dictionary<int, MyPmpValue> dic = new Dictionary<int, MyPmpValue>();
            System.IO.StringReader sr = new System.IO.StringReader(sizestr);
            string line = "";
            int i = 0;
            int curid = 0;
            MyPmpValue myp = new MyPmpValue();
            myp.id = curid;
            while ((line = sr.ReadLine()) != null)
            {
                line = line.TrimStart();
                //
                int i_index = line.IndexOf(i + "{");
                if (i_index == 0)
                {
                    if (i > 0)
                    {
                        dic.Add(curid, myp);
                        myp = new MyPmpValue();
                        curid = i;
                        myp.id = curid;
                        i++;
                    }
                    else
                    {
                        i++;
                    }
                    continue;
                }
                //
                int i_captp = line.IndexOf("caps_type=");
                if (i_captp == 0)
                {
                    // MyPmpValue myp = dic[curid];
                    myp.caps_type = line.Substring(i_captp + 10);
                    continue;
                }
                //
                int i_name = line.IndexOf("name=");
                if (i_name == 0)
                {
                    //MyPmpValue myp = dic[curid];
                    myp.name = line.Substring(i_name + 6);
                    continue;
                }
                //
                int i_localized_name = line.IndexOf("localized_name=");
                if (i_localized_name == 0)
                {
                    //MyPmpValue myp = dic[curid];
                    myp.localized_name = line.Substring(i_localized_name + 16);
                    continue;
                }
                //
                int i_desname = line.IndexOf("media_description_name=");
                if (i_desname == 0)
                {
                    //MyPmpValue myp = dic[curid];
                    myp.media_description_name = line.Substring(i_desname + 24);
                    continue;
                }
                //
                int i_media_group = line.IndexOf("media_group=");
                if (i_media_group == 0)
                {
                    //MyPmpValue myp = dic[curid];
                    myp.media_group = line.Substring(i_media_group + 12);
                    continue;
                }
                //
                int i_landscape_mode = line.IndexOf("landscape_mode=");
                if (i_landscape_mode == 0)
                {
                    string val = line.Substring(i_landscape_mode + 15).Trim().ToLower();
                    //MyPmpValue myp = dic[curid];
                    myp.landscape_mode = val == "true" ? true : false;
                    continue;
                }
            }
            if (!dic.ContainsKey(curid))
            {
                dic.Add(curid, myp);
            }
            return dic;
        }

        private static void GetDes(string desstr, ref Dictionary<int, MyPmpValue> dic)
        {
            System.IO.StringReader sr = new System.IO.StringReader(desstr);
            string line = "";
            int i = 0;
            int curid = 0;
            MyPmpValue mym = dic[curid];
            while ((line = sr.ReadLine()) != null)
            {
                if (i == 28)
                {
                }
                line = line.TrimStart();
                //
                int i_index = line.IndexOf(i + "{");
                if (i_index >= 0)
                {
                    if (i > 0)
                    {
                        curid = i;
                        mym = dic[curid];
                        i++;
                    }
                    else
                    {
                        i++;
                    }
                    continue;
                }
                //
                int i_urx = line.IndexOf("media_bounds_urx=");
                if (i_urx >= 0)
                {
                    string val = line.Substring(i_urx + 17);
                    // mym = dic[curid];
                    mym.media_bounds_urx = Convert.ToDouble(val);
                    dic[curid] = mym;
                    continue;
                }
                //
                int i_ury = line.IndexOf("media_bounds_ury=");
                if (i_ury >= 0)
                {
                    string val = line.Substring(i_ury + 17);
                    //mym = dic[curid];
                    mym.media_bounds_ury = Convert.ToDouble(val);
                    dic[curid] = mym;
                    continue;
                }
            }
        }

        /// <summary>
        /// 文件名 = 项目名称_子项名称_图别_图名_图号
        /// </summary>
        /// <param name="mytk"></param>
        /// <returns></returns>
        public static string GetNameByTKInfo(MyAllTK mytk)
        {
            string filename = "";
            try
            {
                string xmmc = mytk.xmmc;
                string zxmc = mytk.zxmc;
                string tb = mytk.tb;
                string tm = mytk.tm;
                string th = mytk.th;
                if (xmmc != "")
                {
                    filename = xmmc;
                }
                if (zxmc != "")
                {
                    filename = filename + "_" + zxmc;
                }
                if (tb != "")
                {
                    filename = filename + "_" + tb;
                }
                if (tm != "")
                {
                    filename = filename + "_" + tm;
                }
                if (th != "")
                {
                    filename = filename + "_" + th;
                }
            }
            catch (System.Exception ex)
            {

            }
            return filename;
        }

        /// <summary>
        /// 找长宽比最接近的(宽长比)
        /// </summary>
        /// <param name="ext2d"></param>
        /// <param name="media"></param>
        /// <param name="seename"></param>
        /// <param name="isrotate"></param>
        /// <returns></returns>
        public static bool CaclPc3Size(Extents2d ext2d, ref string media, ref string seename, ref bool isrotate)
        {
            media = "UserDefinedMetric (851.00 x 1199.00毫米)";//默认A0
            seename = "A0";
            double diss_min = -1;
            int key = -1;
            try
            {
                double w = ext2d.MaxPoint.X - ext2d.MinPoint.X;//宽
                double h = ext2d.MaxPoint.Y - ext2d.MinPoint.Y;//高
                double s = w / h;//宽高比
                //找宽 跟 高  都差不多的(或者长宽交换后差不多的)
                foreach (KeyValuePair<int, MyPmpValue> item in dicpmp)
                {
                    MyPmpValue mypmp = item.Value;
                    string medianame = mypmp.name;//实际用的
                    string localized_name = mypmp.localized_name;//给用户看到的
                    double x = mypmp.media_bounds_urx;//
                    double y = mypmp.media_bounds_ury;//
                    double u_s1 = Math.Abs(x / y - s);
                    double u_s2 = Math.Abs(y / x - s);
                    double tempdis = u_s1 < u_s2 ? u_s1 : u_s2;
                    //找跟Extents2d 长宽比最接近的
                    if (diss_min < 0)
                    {
                        diss_min = tempdis;
                        key = item.Key;
                        continue;
                    }
                    if (tempdis < diss_min)
                    {
                        diss_min = tempdis;
                        key = item.Key;
                    }
                }
                if (key < 0)
                {
                    return false;
                }
                else
                {
                    MyPmpValue myp = dicpmp[key];
                    media = myp.name;
                    seename = myp.localized_name;
                    //判断是否旋转
                    double x = myp.media_bounds_urx;//
                    double y = myp.media_bounds_ury;//
                    if ((w - h) * (x - y) < 0)
                    {
                        isrotate = true;
                    }
                    else
                        isrotate = false;
                }
            }
            catch (System.Exception ex)
            {

            }
            return false;
        }

        //根据图框大小自动判断要选择的图纸大小,没找到就是false
        public static bool CaclPc3Size(Extents2d ext2d, double scale, ref string media, ref string seename,ref double mediaarea)
        {
            media = "UserDefinedMetric (860.00 x 1210.00毫米)";//默认A0
            seename = "A0";
            double diss_min = -1;
            int key = -1;
            try
            {
                double w = (ext2d.MaxPoint.X - ext2d.MinPoint.X) / scale;//宽
                double h = (ext2d.MaxPoint.Y - ext2d.MinPoint.Y) / scale;//高
                double s = w * h;
                double wh = w / h;
                //找宽 跟 高  都差不多的(或者长宽交换后差不多的)
                bool find_s = false;
                foreach (KeyValuePair<int, MyPmpValue> item in dicpmp)
                {
                    MyPmpValue mypmp = item.Value;
                    if (media=="")
                    {
                        media = mypmp.name;
                    }
                    string medianame = mypmp.name;//实际用的
                    string localized_name = mypmp.localized_name;//给用户看到的
                    double x = mypmp.media_bounds_urx;//
                    double y = mypmp.media_bounds_ury;//
                    double s2 = x * y;
                    //1:找跟Extents2d 大于这个面积且最接近的 
                    if (s2 >= s)
                    {
                        find_s = true;
                        if (diss_min < 0)
                        {
                            diss_min = s2 - s;
                            key = item.Key;
                            continue;
                        }
                        if (s2 - s < diss_min)
                        {
                            diss_min = s2 - s;
                            key = item.Key;
                        }
                    }
                }
                if (!find_s)
                {
                    double fwh = -1;
                    foreach (KeyValuePair<int, MyPmpValue> item in dicpmp)
                    {
                        MyPmpValue mypmp = item.Value;
                        //还可以找 横款比例一样的(争对非标准图框)
                        double x = mypmp.media_bounds_urx;//
                        double y = mypmp.media_bounds_ury;//
                        double wh2 = ((x / y > 1) ^ (wh > 1)) ? (y / x) : (x / y);
                        double abswh = Math.Abs(wh2 - wh);
                        if (fwh < 0)
                        {
                            fwh = abswh;
                            key = item.Key;
                            continue;
                        }
                        if (abswh < fwh)
                        {
                            fwh = abswh;
                            key = item.Key;
                        }
                    }
                }
                
                if (key < 0)
                {
                    return false;
                }
                else
                {
                    MyPmpValue myp = dicpmp[key];
                    media = myp.name;
                    mediaarea = myp.media_bounds_urx * myp.media_bounds_ury;
                    seename = myp.localized_name;
                }
            }
            catch (System.Exception ex)
            {

            }
            return false;
        }
        #endregion

    }
```
